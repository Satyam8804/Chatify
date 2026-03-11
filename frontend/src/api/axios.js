import axios from "axios";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";

// ─── In-Memory Token Store ─────────────────────────────────────────────────────
let inMemoryToken = null;
export const setToken = (token) => (inMemoryToken = token);
export const getToken = () => inMemoryToken;
export const clearToken = () => (inMemoryToken = null);

// ─── Auth Page Helper ──────────────────────────────────────────────────────────
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const isAuthPage = () =>
  AUTH_ROUTES.some((route) => window.location.pathname.startsWith(route));

// ─── Refresh Queue (race condition guard) ─────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response Interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  // ── Success ──────────────────────────────────────────────────────────────────
  (response) => {
    const { method, url } = response.config;
    const isMutating = ["post", "put", "patch", "delete"].includes(method);
    const isMessageUrl = url?.includes("/messages");

    if (isMutating && !isMessageUrl) {
      toast.success(response?.data?.message || "Action completed successfully");
    }

    return response;
  },

  // ── Error ─────────────────────────────────────────────────────────────────
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isRefreshUrl = originalRequest?.url?.includes("/users/refresh-token");

    // ── 401 handling ──────────────────────────────────────────────────────────
    if (status === 401) {
      // 1️⃣ Auth pages (login / register / etc.) → show toast immediately, no refresh
      if (isAuthPage()) {
        const message = error?.response?.data?.message || "Invalid credentials";
        toast.error(message);
        return Promise.reject(error);
      }

      // 2️⃣ Refresh endpoint itself failed → clear session & redirect
      if (isRefreshUrl) {
        clearToken();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      // 3️⃣ Normal protected route — attempt silent token refresh
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        // Queue subsequent requests while refresh is in-flight
        if (isRefreshing) {
          return new Promise((resolve, reject) =>
            failedQueue.push({ resolve, reject })
          )
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch(Promise.reject.bind(Promise));
        }

        isRefreshing = true;

        try {
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL}/users/refresh-token`,
            {},
            { withCredentials: true }
          );

          const newToken = data.accessToken;
          setToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          logger(refreshError);
          clearToken();
          window.location.href = "/login";
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    // ── All other errors → generic toast ─────────────────────────────────────
    const message = error?.response?.data?.message || "Something went wrong";
    toast.error(message);
    return Promise.reject(error);
  }
);

export default api;
