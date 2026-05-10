# Focus Guard

Deep focus enforcement — blocks distracting websites (via `/etc/hosts` DNS poisoning) and kills blacklisted processes (via OS process enumeration), with a React + Electron UI and a C++ system service.

---

## Architecture

```
React UI  ──IPC──▶  Electron main  ──stdin/stdout──▶  C++ service
(render)            (Node.js bridge)                   (kernel ops)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| CMake | ≥ 3.14 (for C++ service) |
| MSVC / GCC / Clang | C++17 |

---

## Build

### 1. Build the C++ service

**Windows (Developer Command Prompt):**
```cmd
cd service
cmake -B build -G "NMake Makefiles"
cmake --build build --config Release
copy build\focus_guard_service.exe ..\public\
```

**macOS / Linux:**
```bash
cd service
cmake -B build
cmake --build build
cp build/focus_guard_service ../public/
```

> The compiled binary must be placed in `public/` so Electron can spawn it.

### 2. Install Node dependencies
```bash
npm install
```

### 3. Run in development
```bash
# Requires admin/root for hosts file modification
npm start          # starts React dev server + Electron together
```

### 4. Build distributable
```bash
npm run build
```

---

## How it works

### Web blocking — Hosts DNS poisoning
When a focus session starts, the C++ service appends entries like:

```
# FOCUS-GUARD-START
127.0.0.1 instagram.com
127.0.0.1 www.instagram.com
# FOCUS-GUARD-END
```

to the system hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows, `/etc/hosts` on Unix), then flushes the DNS cache. When the session ends, these lines are surgically removed and DNS is flushed again.

> **DoH caveat:** Browsers using DNS-over-HTTPS (Chrome, Firefox) may bypass hosts-based blocking. To counter this, disable DoH in browser enterprise policies or use a local DNS proxy (e.g. Pi-hole, `dnsmasq`) that intercepts at the network level.

### Process killing — Toolhelp32Snapshot / /proc
Every second the C++ service:
1. Takes a snapshot of all running processes  
   - Windows: `CreateToolhelp32Snapshot` → `Process32Next`  
   - Linux: reads `/proc/*/comm`  
   - macOS: uses `ps -eo comm`
2. Cross-references against the blocklist
3. Calls `TerminateProcess` (Win) or `SIGKILL` (Unix) on any match
4. Emits a JSON event to Electron, which forwards it to the React UI

### IPC protocol
Electron spawns the C++ service as a child process with `stdin`/`stdout` piped.

**Electron → C++:**
```json
{ "cmd": "start", "sites": ["instagram.com"], "apps": ["steam.exe"] }
{ "cmd": "stop" }
{ "cmd": "quit" }
```

**C++ → Electron:**
```json
{ "event": "hosts_ok" }
{ "event": "hosts_err", "reason": "Cannot write hosts file" }
{ "event": "killed", "name": "steam.exe", "ts": 1700000000 }
{ "event": "stopped" }
```

### Anti-tamper (self-restart)
The C++ service can be compiled with a watchdog thread that re-spawns itself if the parent Electron process dies unexpectedly while a session is active. Enable with `#define ENABLE_WATCHDOG 1` at the top of `focus_guard_service.cpp`.

---

## File structure

```
focus-guard/
├── electron/
│   ├── main.js          # Electron main process (IPC, hosts, process ops)
│   └── preload.js       # Context-isolated bridge to React
├── service/
│   ├── focus_guard_service.cpp   # C++ kernel service
│   ├── CMakeLists.txt
│   └── focus_guard_service.exe.manifest   # Windows UAC manifest
├── src/
│   ├── App.js
│   ├── index.js / index.css
│   └── components/
│       ├── TitleBar.js
│       ├── Setup.js
│       ├── Dashboard.js
│       └── Toast.js
├── public/
│   └── index.html
└── package.json
```

---

## Security notes

- **Admin/root required.** The app will fail gracefully if not elevated — a toast is shown and the session is not started.
- **Hosts file is never permanently modified.** The service always cleans up on stop, crash, or system shutdown (via the Electron `before-quit` hook).
- **No remote server.** All data stays local. The blocklist is stored in React state only.
