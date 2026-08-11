import React, { useEffect, useState } from 'react';
import { ThemeContext } from './ThemeContext';

export function ThemeProvider({ children }) {
    // Default: light mode
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('hms-theme') || 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('hms-theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
