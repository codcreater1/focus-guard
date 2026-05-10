import React, { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Dashboard from './components/Dashboard';
import Setup from './components/Setup';
import Toast from './components/Toast';

// Fallback IPC mock for browser dev (no Electron)
const api = window.focusGuard || {
  startFocus: async (c) => { console.log('startFocus', c); return { ok: true }; },
  stopFocus: async () => ({ ok: true }),
  getStatus: async () => ({ active: false, sites: [], apps: [] }),
  minimize: () => {},
  maximize: () => {},
  close: () => {},
  onAppKilled: () => {},
  onExitBlocked: () => {},
  removeAllListeners: () => {},
};

export default function App() {
  const [view, setView] = useState('setup'); // 'setup' | 'active'
  const [config, setConfig] = useState({
    sites: ['instagram.com', 'twitter.com', 'youtube.com', 'reddit.com', 'facebook.com'],
    apps: ['steam.exe', 'discord.exe', 'spotify.exe'],
    duration: 25, // minutes
  });
  const [sessionStart, setSessionStart] = useState(null);
  const [toasts, setToasts] = useState([]);

  const pushToast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  useEffect(() => {
    api.onAppKilled(({ name }) => pushToast(`🛑 Blocked: ${name}`, 'danger'));
    api.onExitBlocked((msg) => pushToast(msg, 'warning'));
    return () => {
      api.removeAllListeners('app-killed');
      api.removeAllListeners('exit-blocked');
    };
  }, []);

  const handleStart = async () => {
    const res = await api.startFocus({
      sites: config.sites,
      apps: config.apps,
      duration: config.duration,
    });
    if (res.ok) {
      setSessionStart(Date.now());
      setView('active');
      pushToast('Focus session started', 'success');
    } else {
      pushToast(res.reason || 'Failed to start', 'danger');
    }
  };

  const handleStop = async () => {
    const res = await api.stopFocus();
    if (res.ok) {
      setView('setup');
      setSessionStart(null);
      pushToast('Session ended — well done!', 'success');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar api={api} active={view === 'active'} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'setup' ? (
          <Setup config={config} setConfig={setConfig} onStart={handleStart} />
        ) : (
          <Dashboard
            config={config}
            sessionStart={sessionStart}
            onStop={handleStop}
            pushToast={pushToast}
          />
        )}
      </div>
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 999 }}>
        {toasts.map((t) => (
          <Toast key={t.id} msg={t.msg} type={t.type} />
        ))}
      </div>
    </div>
  );
}
