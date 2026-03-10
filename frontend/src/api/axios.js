import axios from "axios";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// ✅ In-memory token store
let inMemoryToken = null;
export const setToken = (token) => (inMemoryToken = token);
export const getToken = () => inMemoryToken;
export const clearToken = () => (inMemoryToken = null);

// Race condition guard
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const token = getToken(); // ✅ from memory
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => {
    const method = response.config.method;
    const url = response.config.url;

    if (
      ["post", "put", "patch", "delete"].includes(method) &&
      !url.includes("/messages")
    ) {
      const message =
        response?.data?.message || "Action completed successfully";
      toast.success(message);
    }

    return response;
  },

  async (error) => {
    const originalRequest = error.config;
    const isRefreshRequest = originalRequest?.url?.includes(
      "/users/refresh-token"
    );

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/users/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newToken = res.data.accessToken;
        setToken(newToken); // ✅ memory only
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logger(refreshError);
        clearToken(); // ✅ memory only

        const authRoutes = ["/login", "/register", "/forgot-password"];
        const isAuthPage = authRoutes.some((route) =>
          window.location.pathname.startsWith(route)
        );

        if (!isAuthPage) window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const isAuthPage = ["/login", "/register"].some((route) =>
      window.location.pathname.startsWith(route)
    );

    if (error.response?.status === 401 && isAuthPage) {
      return Promise.reject(error);
    }

    const message = error?.response?.data?.message || "Something went wrong";
    toast.error(message);
    return Promise.reject(error);
  }
);

export default api;
