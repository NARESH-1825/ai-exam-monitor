// frontend/src/services/api.js
import axios from "axios";

// Get API URL from environment variables
// Falls back to localhost for development
const getApiUrl = () => {
  const env = import.meta.env.VITE_API_URL;
  if (env) return env;
  return "http://localhost:5000/api";
};

const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
  timeout: 30000, // 30 second timeout for Render cold starts
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    if (response?.status === 401) {
      const code = response.data?.code;
      if (code === "SESSION_INVALIDATED") {
        // Handled by Firestore listener in useAuthSync — just clear storage
      }
      localStorage.removeItem("token");
      localStorage.removeItem("authUser");
      // Let useAuthSync handle navigation via Firestore
    }
    return Promise.reject(error);
  },
);

export default api;
