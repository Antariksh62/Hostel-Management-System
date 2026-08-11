import React, { useState, useCallback } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const token = sessionStorage.getItem("token");
            const storedUser = sessionStorage.getItem("user");

            if (token && storedUser) {
                api.defaults.headers.Authorization = `Bearer ${token}`;
                return JSON.parse(storedUser);
            } else {
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
            }
        } catch {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
        }
        return null;
    });

    const [loading] = useState(false);

    // 🔥 WARDEN / STAFF LOGIN (email + password)
    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { token, user: userData } = res.data;

        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));

        api.defaults.headers.Authorization = `Bearer ${token}`;
        setUser(userData);

        return res.data;
    };

    // 🔥 STUDENT OTP LOGIN — called after OTP verification + profile completion
    const studentLogin = useCallback((token, userData) => {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));

        api.defaults.headers.Authorization = `Bearer ${token}`;
        setUser(userData);
    }, []);

    // 🔥 REGISTER
    const register = async (name, email, password, role) => {
        await api.post('/auth/register', { name, email, password, role });
    };

    // 🔥 LOGOUT
    const logout = useCallback(() => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');

        delete api.defaults.headers.Authorization;

        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, studentLogin, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
