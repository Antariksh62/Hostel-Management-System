import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 🔥 LOAD USER FROM SESSIONSTORAGE
    useEffect(() => {
        try {
            const token = sessionStorage.getItem("token");
            const storedUser = sessionStorage.getItem("user");

            if (token && storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);

                // ✅ Attach token to axios globally
                api.defaults.headers.Authorization = `Bearer ${token}`;
            } else {
                // clean inconsistent state
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
            }

        } catch (err) {
            console.error("Invalid user in sessionStorage");
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
        }

        setLoading(false);
    }, []);

    // 🔥 LOGIN
    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });

        const { token, user } = res.data;

        // ✅ Store token + user
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));

        // ✅ Attach token to axios
        api.defaults.headers.Authorization = `Bearer ${token}`;

        // ✅ Set state
        setUser(user);

        return res.data;
    };

    // 🔥 REGISTER
    const register = async (name, email, password, role) => {
        await api.post('/auth/register', { name, email, password, role });
    };

    // 🔥 LOGOUT
    const logout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');

        delete api.defaults.headers.Authorization;

        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};