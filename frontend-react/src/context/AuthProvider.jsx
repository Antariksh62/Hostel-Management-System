import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContext';
import i18n from '../i18n';
import { LANGUAGE_STORAGE_KEY } from '../i18n/languageConfig';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const token = sessionStorage.getItem("token");
            const storedUser = sessionStorage.getItem("user");
            const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);

            if (token && storedUser) {
                api.defaults.headers.Authorization = `Bearer ${token}`;
                const parsed = JSON.parse(storedUser);
                const activeLang = savedLang || parsed?.preferredLanguage || 'en';
                i18n.changeLanguage(activeLang);
                return parsed;
            } else {
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                if (savedLang) {
                    i18n.changeLanguage(savedLang);
                } else {
                    i18n.changeLanguage('en');
                }
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

        const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        const activeLang = savedLang || userData?.preferredLanguage || 'en';
        i18n.changeLanguage(activeLang);
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, activeLang);
            localStorage.setItem('i18nextLng', activeLang);
        } catch (_) {}

        return res.data;
    };

    // 🔥 STUDENT OTP LOGIN — called after OTP verification + profile completion
    const studentLogin = useCallback((token, userData) => {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));

        api.defaults.headers.Authorization = `Bearer ${token}`;
        setUser(userData);

        const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        const activeLang = savedLang || userData?.preferredLanguage || 'en';
        i18n.changeLanguage(activeLang);
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, activeLang);
            localStorage.setItem('i18nextLng', activeLang);
        } catch (_) {}
    }, []);

    // 🔥 UPDATE USER PROFILE IN STATE & STORAGE
    const updateUser = useCallback((updatedUserData) => {
        sessionStorage.setItem('user', JSON.stringify(updatedUserData));
        setUser(updatedUserData);
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
        <AuthContext.Provider value={{ user, loading, login, studentLogin, logout, register, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};
