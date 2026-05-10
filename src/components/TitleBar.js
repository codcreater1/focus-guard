import React from 'react';

const s = {
  bar: {
    height: 42,
    background: '#0a0a0f',
    borderBottom: '1px solid #1a1a28',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    WebkitAppRegion: 'drag',
    flexShrink: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'Space Mono, monospace',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#6c63ff',
  },
  dot: (active) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: active ? '#00e396' : '#3a3a4f',
    boxShadow: active ? '0 0 8px #00e396' : 'none',
    transition: 'all 0.3s',
  }),
  controls: {
    display: 'flex',
    gap: 8,
    WebkitAppRegion: 'no-drag',
  },
  btn: (color) => ({
    width: 13,
    height: 13,
    borderRadius: '50%',
    background: color,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  }),
};

export default function TitleBar({ api, active }) {
  return (
    <div style={s.bar}>
      <div style={s.logo}>
        <span style={s.dot(active)} />
        FOCUS — GUARD
      </div>
      <div style={s.controls}>
        <button style={s.btn('#feb019')} onClick={() => api.minimize()} title="Minimize" />
        <button style={s.btn('#6c63ff')} onClick={() => api.maximize()} title="Maximize" />
        <button style={s.btn('#ff4560')} onClick={() => api.close()} title="Close" />
      </div>
    </div>
  );
}
