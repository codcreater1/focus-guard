import React, { useState } from 'react';

const PRESET_SITES = [
  'instagram.com', 'twitter.com', 'youtube.com', 'reddit.com',
  'facebook.com', 'tiktok.com', 'twitch.tv', 'linkedin.com',
];
const PRESET_APPS = [
  'steam.exe', 'discord.exe', 'spotify.exe', 'slack.exe',
  'teams.exe', 'obs64.exe', 'vlc.exe',
];

const css = {
  root: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  left: {
    flex: 1,
    padding: '36px 32px',
    overflowY: 'auto',
    borderRight: '1px solid #1a1a28',
  },
  right: {
    width: 280,
    padding: '36px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    background: '#0d0d14',
  },
  heading: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    color: '#5a5a72',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  chip: (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'Space Mono, monospace',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: `1px solid ${active ? '#6c63ff' : '#2a2a3a'}`,
    background: active ? '#1a1830' : 'transparent',
    color: active ? '#8b85ff' : '#5a5a72',
    margin: '0 6px 6px 0',
  }),
  customInput: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    background: '#111118',
    border: '1px solid #2a2a3a',
    borderRadius: 8,
    padding: '8px 12px',
    color: '#e8e8f0',
    fontSize: 13,
    fontFamily: 'Space Mono, monospace',
    transition: 'border-color 0.2s',
  },
  addBtn: {
    background: '#6c63ff',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  durationBlock: {
    background: '#111118',
    border: '1px solid #2a2a3a',
    borderRadius: 12,
    padding: 20,
  },
  durationVal: {
    fontSize: 40,
    fontWeight: 700,
    fontFamily: 'Space Mono, monospace',
    color: '#6c63ff',
    lineHeight: 1,
  },
  durationLabel: { fontSize: 12, color: '#5a5a72', marginTop: 4 },
  slider: {
    width: '100%',
    marginTop: 14,
    accentColor: '#6c63ff',
    cursor: 'pointer',
  },
  presets: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  presetBtn: (active) => ({
    padding: '5px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${active ? '#6c63ff' : '#2a2a3a'}`,
    background: active ? '#1a1830' : 'transparent',
    color: active ? '#8b85ff' : '#5a5a72',
    transition: 'all 0.15s',
  }),
  startBtn: {
    marginTop: 'auto',
    background: 'linear-gradient(135deg, #6c63ff, #a855f7)',
    color: '#fff',
    borderRadius: 12,
    padding: '16px',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'opacity 0.2s, transform 0.1s',
    boxShadow: '0 4px 20px rgba(108,99,255,0.3)',
  },
  summary: {
    background: '#111118',
    border: '1px solid #2a2a3a',
    borderRadius: 12,
    padding: 16,
    fontSize: 12,
    color: '#9090a8',
    lineHeight: 1.8,
  },
  summaryVal: { color: '#e8e8f0', fontWeight: 600 },
};

const DURATION_PRESETS = [25, 45, 60, 90];

export default function Setup({ config, setConfig, onStart }) {
  const [newSite, setNewSite] = useState('');
  const [newApp, setNewApp] = useState('');

  const toggleSite = (s) => {
    setConfig((c) => ({
      ...c,
      sites: c.sites.includes(s) ? c.sites.filter((x) => x !== s) : [...c.sites, s],
    }));
  };

  const toggleApp = (a) => {
    setConfig((c) => ({
      ...c,
      apps: c.apps.includes(a) ? c.apps.filter((x) => x !== a) : [...c.apps, a],
    }));
  };

  const addSite = () => {
    const v = newSite.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (v && !config.sites.includes(v)) {
      setConfig((c) => ({ ...c, sites: [...c.sites, v] }));
    }
    setNewSite('');
  };

  const addApp = () => {
    const v = newApp.trim();
    if (v && !config.apps.includes(v)) {
      setConfig((c) => ({ ...c, apps: [...c.apps, v] }));
    }
    setNewApp('');
  };

  const allSites = [...new Set([...PRESET_SITES, ...config.sites])];
  const allApps = [...new Set([...PRESET_APPS, ...config.apps])];

  return (
    <div style={css.root}>
      <div style={css.left}>
        {/* Sites */}
        <div style={{ marginBottom: 36 }}>
          <div style={css.heading}>🌐 Block websites</div>
          <div>
            {allSites.map((s) => (
              <span key={s} style={css.chip(config.sites.includes(s))} onClick={() => toggleSite(s)}>
                {config.sites.includes(s) ? '✕' : '+'} {s}
              </span>
            ))}
          </div>
          <div style={css.customInput}>
            <input
              style={css.input}
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSite()}
              placeholder="custom-site.com"
            />
            <button style={css.addBtn} onClick={addSite}>Add</button>
          </div>
        </div>

        {/* Apps */}
        <div>
          <div style={css.heading}>🖥 Block applications</div>
          <div>
            {allApps.map((a) => (
              <span key={a} style={css.chip(config.apps.includes(a))} onClick={() => toggleApp(a)}>
                {config.apps.includes(a) ? '✕' : '+'} {a}
              </span>
            ))}
          </div>
          <div style={css.customInput}>
            <input
              style={css.input}
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addApp()}
              placeholder="process.exe"
            />
            <button style={css.addBtn} onClick={addApp}>Add</button>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={css.right}>
        {/* Duration */}
        <div style={css.durationBlock}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#5a5a72', textTransform: 'uppercase', marginBottom: 10 }}>
            Session Duration
          </div>
          <div style={css.durationVal}>{config.duration}</div>
          <div style={css.durationLabel}>minutes</div>
          <input
            type="range"
            style={css.slider}
            min={5} max={180} step={5}
            value={config.duration}
            onChange={(e) => setConfig((c) => ({ ...c, duration: Number(e.target.value) }))}
          />
          <div style={css.presets}>
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                style={css.presetBtn(config.duration === d)}
                onClick={() => setConfig((c) => ({ ...c, duration: d }))}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={css.summary}>
          <div>Sites blocked: <span style={css.summaryVal}>{config.sites.length}</span></div>
          <div>Apps blocked: <span style={css.summaryVal}>{config.apps.length}</span></div>
          <div>Duration: <span style={css.summaryVal}>{config.duration} min</span></div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a2a3a', fontSize: 11, color: '#5a5a72' }}>
            Requires Admin/Root to modify hosts file
          </div>
        </div>

        <button
          style={css.startBtn}
          disabled={config.sites.length === 0 && config.apps.length === 0}
          onClick={onStart}
          onMouseEnter={(e) => (e.target.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.target.style.opacity = '1')}
        >
          START FOCUS SESSION →
        </button>
      </div>
    </div>
  );
}
