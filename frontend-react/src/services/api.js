import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
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
        if (error.response) {
            const isUnauthorized = error.response.status === 401;
            const isRevoked = error.response.status === 403 && error.response.data?.code === 'ELIGIBILITY_REVOKED';

            if (isUnauthorized || isRevoked) {
                console.error(isRevoked ? "Eligibility Revoked - logging out" : "Unauthorized - logging out");

                // clear sessionStorage and localStorage (must match AuthContext)
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                localStorage.removeItem("token");
                localStorage.removeItem("user");

                if (isRevoked) {
                    sessionStorage.setItem("revocation_notice", error.response.data?.message || "Your hostel admission eligibility has been revoked.");
                }

                window.location.href = "/";
            }
        }

        return Promise.reject(error);
    }
);

export default api;
