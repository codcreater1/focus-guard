import React, { useState, useEffect, useRef } from 'react';

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

const css = {
  root: { display: 'flex', height: '100%', overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, position: 'relative' },
  ringWrap: { position: 'relative', width: 240, height: 240, marginBottom: 36 },
  timeText: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  timeVal: { fontFamily: 'Space Mono, monospace', fontSize: 42, fontWeight: 700, color: '#e8e8f0', letterSpacing: '0.02em' },
  timeLabel: { fontSize: 11, color: '#5a5a72', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 },
  stats: { display: 'flex', gap: 24, marginBottom: 36 },
  stat: { textAlign: 'center', background: '#111118', border: '1px solid #2a2a3a', borderRadius: 10, padding: '12px 20px', minWidth: 90 },
  statVal: { fontFamily: 'Space Mono, monospace', fontSize: 22, fontWeight: 700, color: '#6c63ff' },
  statLabel: { fontSize: 11, color: '#5a5a72', marginTop: 4 },
  stopBtn: { background: 'transparent', border: '1px solid #ff4560', color: '#ff4560', borderRadius: 10, padding: '12px 32px', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.2s' },
  sidebar: { width: 280, padding: '24px 20px', background: '#0d0d14', borderLeft: '1px solid #1a1a28', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sideHeading: { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#5a5a72', textTransform: 'uppercase', marginBottom: 14 },
  log: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 },
  logItem: { background: '#111118', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logName: { fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#ff4560' },
  logTime: { fontSize: 10, color: '#5a5a72', fontFamily: 'Space Mono, monospace' },
  blocked: { marginTop: 24 },
  blockedHeading: { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#5a5a72', textTransform: 'uppercase', marginBottom: 10 },
  tag: { display: 'inline-block', background: '#111118', border: '1px solid #2a2a3a', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontFamily: 'Space Mono, monospace', color: '#5a5a72', margin: '0 4px 4px 0' },
};

const RADIUS = 96;
const CIRC = 2 * Math.PI * RADIUS;

export default function Dashboard({ config, sessionStart, onStop, pushToast }) {
  const durationMs = config.duration * 60 * 1000;
  const [elapsed, setElapsed] = useState(0);
  const [killLog, setKillLog] = useState([]);
  const [killCount, setKillCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const e = Date.now() - sessionStart;
      setElapsed(e);
      if (e >= durationMs) {
        clearInterval(intervalRef.current);
        pushToast('⏰ Session complete!', 'success');
        onStop();
      }
    }, 500);
    return () => clearInterval(intervalRef.current);
  }, [sessionStart, durationMs]);

  useEffect(() => {
    const handler = window.focusGuard?.onAppKilled;
    if (handler) {
      handler((data) => {
        setKillLog((l) => [{ name: data.name, ts: new Date(data.ts).toLocaleTimeString() }, ...l].slice(0, 50));
        setKillCount((k) => k + 1);
      });
    }
  }, []);

  const remaining = Math.max(0, durationMs - elapsed);
  const progress = Math.min(1, elapsed / durationMs);
  const dashOffset = CIRC * (1 - progress);
  const isFinalStretch = remaining > 0 && remaining <= 60000;
  const ringColor = isFinalStretch ? '#ff4560' : '#6c63ff';

  return (
    <div style={css.root}>
      <div style={css.main}>
        <div style={css.ringWrap}>
          <svg width="240" height="240" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="120" cy="120" r={RADIUS} fill="none" stroke="#1a1a28" strokeWidth="6" />
            <circle
              cx="120" cy="120" r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 8px ${ringColor}88)` }}
            />
          </svg>
          <div style={css.timeText}>
            <div style={{ ...css.timeVal, color: isFinalStretch ? '#ff4560' : css.timeVal.color, transition: 'color 0.3s ease' }}>{formatTime(remaining)}</div>
            <div style={css.timeLabel}>remaining · {Math.round(progress * 100)}%</div>
          </div>
        </div>

        <div style={css.stats}>
          <div style={css.stat}>
            <div style={css.statVal}>{config.sites.length}</div>
            <div style={css.statLabel}>Sites locked</div>
          </div>
          <div style={css.stat}>
            <div style={css.statVal}>{config.apps.length}</div>
            <div style={css.statLabel}>Apps monitored</div>
          </div>
          <div style={{ ...css.stat }}>
            <div style={{ ...css.statVal, color: killCount > 0 ? '#ff4560' : '#6c63ff' }}>{killCount}</div>
            <div style={css.statLabel}>Processes killed</div>
          </div>
        </div>

        <button
          style={css.stopBtn}
          onClick={onStop}
          onMouseEnter={(e) => { e.target.style.background = '#ff456015'; }}
          onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
        >
          END SESSION
        </button>
      </div>

      <div style={css.sidebar}>
        <div style={css.sideHeading}>Kill log</div>
        <div style={css.log}>
          {killLog.length === 0 ? (
            <div style={{ color: '#3a3a4f', fontSize: 12, fontFamily: 'Space Mono, monospace', paddingTop: 8 }}>
              No kills yet — staying focused
            </div>
          ) : (
            killLog.map((item, i) => (
              <div key={i} style={css.logItem}>
                <span style={css.logName}>✕ {item.name}</span>
                <span style={css.logTime}>{item.ts}</span>
              </div>
            ))
          )}
        </div>

        <div style={css.blocked}>
          <div style={css.blockedHeading}>Blocked sites</div>
          <div>
            {config.sites.map((s) => (
              <span key={s} style={css.tag}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
