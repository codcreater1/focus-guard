/**
 * focus_guard_service.cpp
 * System-level enforcement service for Focus Guard.
 *
 * Compile (Windows):
 *   cl /std:c++17 /EHsc focus_guard_service.cpp /link advapi32.lib
 *
 * Compile (Linux/macOS):
 *   g++ -std=c++17 -o focus_guard_service focus_guard_service.cpp
 *
 * Requires Administrator / root privileges.
 *
 * Communication: reads JSON commands from stdin, writes events to stdout.
 * Protocol:
 *   IN  { "cmd": "start", "sites": [...], "apps": [...] }
 *   IN  { "cmd": "stop" }
 *   OUT { "event": "killed", "name": "steam.exe", "ts": 1700000000 }
 *   OUT { "event": "hosts_ok" }
 *   OUT { "event": "hosts_err", "reason": "..." }
 *   OUT { "event": "stopped" }
 */

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <set>
#include <thread>
#include <atomic>
#include <chrono>
#include <cstdlib>
#include <algorithm>

#ifdef _WIN32
  #define WIN32_LEAN_AND_MEAN
  #include <windows.h>
  #include <tlhelp32.h>
  #define HOSTS_PATH "C:\\Windows\\System32\\drivers\\etc\\hosts"
  #define FLUSH_CMD  "ipconfig /flushdns > nul 2>&1"
#else
  #include <signal.h>
  #include <dirent.h>
  #include <cstring>
  #include <sys/types.h>
  #include <unistd.h>
  #define HOSTS_PATH "/etc/hosts"
  #ifdef __APPLE__
    #define FLUSH_CMD "dscacheutil -flushcache; killall -HUP mDNSResponder 2>/dev/null"
  #else
    #define FLUSH_CMD "systemd-resolve --flush-caches 2>/dev/null || true"
  #endif
#endif

// ─── Configuration ────────────────────────────────────────────────────────────
static const std::string HOSTS_MARKER_START = "# FOCUS-GUARD-START";
static const std::string HOSTS_MARKER_END   = "# FOCUS-GUARD-END";
static const int MONITOR_INTERVAL_MS        = 1000;

// ─── State ────────────────────────────────────────────────────────────────────
static std::atomic<bool> g_active{false};
static std::vector<std::string> g_blocked_sites;
static std::vector<std::string> g_blocked_apps;

// ─── Utility ─────────────────────────────────────────────────────────────────
static void flush_dns() {
    std::system(FLUSH_CMD);
}

static std::string to_lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), ::tolower);
    return s;
}

static long long unix_ts() {
    using namespace std::chrono;
    return duration_cast<seconds>(system_clock::now().time_since_epoch()).count();
}

// ─── Hosts file management ────────────────────────────────────────────────────
static bool append_hosts(const std::vector<std::string>& sites) {
    // Read current content
    std::ifstream in(HOSTS_PATH);
    if (!in.is_open()) {
        std::cout << "{\"event\":\"hosts_err\",\"reason\":\"Cannot open hosts file\"}" << std::endl;
        return false;
    }
    std::stringstream buf;
    buf << in.rdbuf();
    in.close();
    std::string content = buf.str();

    // Idempotency check
    if (content.find(HOSTS_MARKER_START) != std::string::npos) {
        std::cout << "{\"event\":\"hosts_ok\"}" << std::endl;
        return true;
    }

    // Build block
    std::string block = "\n" + HOSTS_MARKER_START + "\n";
    for (const auto& site : sites) {
        block += "127.0.0.1 " + site + "\n";
        block += "127.0.0.1 www." + site + "\n";
    }
    block += HOSTS_MARKER_END + "\n";

    std::ofstream out(HOSTS_PATH, std::ios::app);
    if (!out.is_open()) {
        std::cout << "{\"event\":\"hosts_err\",\"reason\":\"Cannot write hosts file — run as admin\"}" << std::endl;
        return false;
    }
    out << block;
    out.close();
    flush_dns();
    std::cout << "{\"event\":\"hosts_ok\"}" << std::endl;
    return true;
}

static void remove_hosts() {
    std::ifstream in(HOSTS_PATH);
    if (!in.is_open()) return;
    std::stringstream buf;
    buf << in.rdbuf();
    in.close();
    std::string content = buf.str();

    auto start_pos = content.find("\n" + HOSTS_MARKER_START);
    auto end_pos   = content.find(HOSTS_MARKER_END);
    if (start_pos == std::string::npos || end_pos == std::string::npos) return;

    std::string cleaned = content.substr(0, start_pos)
                        + content.substr(end_pos + HOSTS_MARKER_END.size());

    std::ofstream out(HOSTS_PATH);
    if (!out.is_open()) return;
    out << cleaned;
    out.close();
    flush_dns();
}

// ─── Process enumeration & termination ────────────────────────────────────────
#ifdef _WIN32

static std::vector<std::pair<std::string, DWORD>> list_processes() {
    std::vector<std::pair<std::string, DWORD>> result;
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return result;

    PROCESSENTRY32W pe;
    pe.dwSize = sizeof(pe);
    if (Process32FirstW(snap, &pe)) {
        do {
            // Convert wide to narrow
            std::wstring ws(pe.szExeFile);
            std::string name(ws.begin(), ws.end());
            result.push_back({ to_lower(name), pe.th32ProcessID });
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return result;
}

static void kill_pid(DWORD pid) {
    HANDLE h = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
    if (h) {
        TerminateProcess(h, 0);
        CloseHandle(h);
    }
}

#else // POSIX

static std::vector<std::pair<std::string, pid_t>> list_processes() {
    std::vector<std::pair<std::string, pid_t>> result;
    DIR* dir = opendir("/proc");
    if (!dir) return result;
    struct dirent* ent;
    while ((ent = readdir(dir)) != nullptr) {
        // Only numeric dirs = PIDs
        bool all_digits = true;
        for (char c : std::string(ent->d_name)) {
            if (!std::isdigit(c)) { all_digits = false; break; }
        }
        if (!all_digits) continue;
        pid_t pid = std::stoi(ent->d_name);
        std::string comm_path = "/proc/" + std::string(ent->d_name) + "/comm";
        std::ifstream comm(comm_path);
        if (!comm.is_open()) continue;
        std::string name;
        std::getline(comm, name);
        result.push_back({ to_lower(name), pid });
    }
    closedir(dir);
    return result;
}

static void kill_pid(pid_t pid) {
    kill(pid, SIGKILL);
}

#endif

// ─── Monitor thread ───────────────────────────────────────────────────────────
static void monitor_loop() {
    while (g_active.load()) {
        auto processes = list_processes();
        for (const auto& proc : processes) {
            for (const auto& blocked : g_blocked_apps) {
                if (proc.first.find(to_lower(blocked)) != std::string::npos) {
                    kill_pid(proc.second);
                    // Emit event to Electron
                    std::cout << "{\"event\":\"killed\",\"name\":\""
                              << blocked << "\",\"ts\":" << unix_ts() << "}"
                              << std::endl;
                    break;
                }
            }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(MONITOR_INTERVAL_MS));
    }
}

// ─── Minimal JSON field extractor ────────────────────────────────────────────
// Full JSON parser intentionally avoided (no external deps).
// Protocol is simple enough for targeted extraction.
static std::string extract_string(const std::string& json, const std::string& key) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return "";
    pos = json.find("\"", pos + key.size() + 2);
    if (pos == std::string::npos) return "";
    auto end = json.find("\"", pos + 1);
    if (end == std::string::npos) return "";
    return json.substr(pos + 1, end - pos - 1);
}

static std::vector<std::string> extract_array(const std::string& json, const std::string& key) {
    std::vector<std::string> result;
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return result;
    auto arr_start = json.find("[", pos);
    auto arr_end   = json.find("]", arr_start);
    if (arr_start == std::string::npos || arr_end == std::string::npos) return result;
    std::string arr = json.substr(arr_start + 1, arr_end - arr_start - 1);
    size_t i = 0;
    while (i < arr.size()) {
        auto s = arr.find("\"", i);
        if (s == std::string::npos) break;
        auto e = arr.find("\"", s + 1);
        if (e == std::string::npos) break;
        result.push_back(arr.substr(s + 1, e - s - 1));
        i = e + 1;
    }
    return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
int main() {
    // Disable stdout buffering for real-time IPC
    std::cout.setf(std::ios::unitbuf);
    std::setvbuf(stdout, nullptr, _IONBF, 0);

    std::string line;
    std::thread monitor_thread;

    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        std::string cmd = extract_string(line, "cmd");

        if (cmd == "start") {
            if (g_active.load()) continue; // already running

            g_blocked_sites = extract_array(line, "sites");
            g_blocked_apps  = extract_array(line, "apps");
            g_active.store(true);

            append_hosts(g_blocked_sites);

            monitor_thread = std::thread(monitor_loop);
            monitor_thread.detach();

        } else if (cmd == "stop") {
            if (!g_active.load()) continue;
            g_active.store(false);

            // Give monitor thread one cycle to exit
            std::this_thread::sleep_for(std::chrono::milliseconds(MONITOR_INTERVAL_MS + 100));

            remove_hosts();
            std::cout << "{\"event\":\"stopped\"}" << std::endl;

        } else if (cmd == "quit") {
            g_active.store(false);
            remove_hosts();
            break;
        }
    }

    return 0;
}
