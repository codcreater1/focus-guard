import React, { useEffect, useState } from 'react';

const COLORS = {
  info:    { bg: '#1a1830', border: '#6c63ff', text: '#8b85ff' },
  success: { bg: '#0a1a12', border: '#00e396', text: '#00e396' },
  danger:  { bg: '#1a0a0e', border: '#ff4560', text: '#ff4560' },
  warning: { bg: '#1a1200', border: '#feb019', text: '#feb019' },
};

export default function Toast({ msg, type = 'info' }) {
  const [visible, setVisible] = useState(false);
  const c = COLORS[type] || COLORS.info;

  useEffect(() => {
    setTimeout(() => setVisible(true), 10);
  }, []);

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: '10px 16px',
      fontSize: 13,
      color: c.text,
      fontFamily: 'Space Grotesk, sans-serif',
      maxWidth: 300,
      boxShadow: `0 4px 20px ${c.border}22`,
      transform: visible ? 'translateX(0)' : 'translateX(20px)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      {msg}
    </div>
  );
}
