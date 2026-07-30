import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ style = {} }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                border: '1px solid var(--th-border)',
                borderRadius: '20px',
                background: 'var(--th-btn-bg)',
                color: 'var(--th-text)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'inherit',
                transition: 'all .2s',
                whiteSpace: 'nowrap',
                ...style
            }}
        >
            <span style={{ fontSize: 15 }}>{isDark ? '☀️' : '🌙'}</span>
            {isDark ? 'Light' : 'Dark'}
        </button>
    );
}
