import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: false,
});

// 🔥 REQUEST INTERCEPTOR - reads from sessionStorage (matches AuthContext)
api.interceptors.request.use(
    (config) => {
        // Use the default header set by AuthContext if available,
        // otherwise fall back to reading directly from sessionStorage
        if (!config.headers.Authorization) {
            const token = sessionStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 🔥 RESPONSE INTERCEPTOR (handle auth errors globally)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error("Unauthorized - logging out");

            // clear sessionStorage (must match AuthContext)
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");

            window.location.href = "/login";
        }

        return Promise.reject(error);
    }
);

export default api;