import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add authorization header to all requests if token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    
    // Public authentication endpoints that do not require validation
    const publicPaths = [
      "/auth/login",
      "/auth/signup",
      "/auth/verify-email",
      "/auth/forgot-password",
      "/auth/reset-password"
    ];
    
    const isPublic = publicPaths.some((path) => config.url && config.url.includes(path));

    if (!token && !isPublic) {
      // Clear storage just in case and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(new Error("Unauthorized: Authentication token is missing."));
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Redirect to login if not already there
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
