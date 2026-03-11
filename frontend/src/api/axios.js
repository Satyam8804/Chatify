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

// ─── Refresh State ─────────────────────────────────────────────────────────────
let refreshPromise = null; // shared Promise — only ONE refresh call ever in-flight

const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise; // ✅ reuse if already running

  refreshPromise = axios
    .post(
      `${import.meta.env.VITE_API_URL}/users/refresh-token`,
      {},
      { withCredentials: true }
    )
    .then(({ data }) => {
      setToken(data.accessToken);
      return data.accessToken;
    })
    .catch((err) => {
      logger(err);
      clearToken();
      window.location.href = "/login";
      return Promise.reject(err);
    })
    .finally(() => {
      refreshPromise = null; // ✅ reset so future refreshes can run
    });

  return refreshPromise;
};

// ─── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// ─── Request Interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response Interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  // ── Success Handler ──────────────────────────────────────────────────────────
  (response) => {
    const { method, url } = response.config;
    const isMutating = ["post", "put", "patch", "delete"].includes(method);
    const isMessageUrl = url?.includes("/messages");

    if (isMutating && !isMessageUrl) {
      toast.success(response?.data?.message || "Action completed successfully");
    }

    return response;
  },

  // ── Error Handler ─────────────────────────────────────────────────────────────
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isRefreshUrl = originalRequest?.url?.includes("/users/refresh-token");

    if (status === 401) {
      // 1️⃣ Auth pages → show toast, no refresh attempt
      if (isAuthPage()) {
        toast.error(error?.response?.data?.message || "Invalid credentials");
        return Promise.reject(error);
      }

      // 2️⃣ Refresh endpoint itself failed → clear & redirect
      if (isRefreshUrl) {
        clearToken();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      // 3️⃣ Protected route → silent refresh
      //    All concurrent 401s share ONE refreshPromise — no waterfall
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const token = await refreshAccessToken(); // ✅ shared, not duplicated
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }
    }

    // ── All other errors ──────────────────────────────────────────────────────
    toast.error(error?.response?.data?.message || "Something went wrong");
    return Promise.reject(error);
  }
);

export default api;
