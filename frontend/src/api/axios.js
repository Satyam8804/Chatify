import axios from "axios";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";

let inMemoryToken = null;

export const setToken = (token) => {
  inMemoryToken = token;
};

export const getToken = () => inMemoryToken;

export const clearToken = () => {
  inMemoryToken = null;
};

let refreshPromise = null;

// 🔥 SAFE REFRESH WITH TIMEOUT
export const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = Promise.race([
    axios.post(
      `${import.meta.env.VITE_API_URL}/users/refresh-token`,
      {},
      { withCredentials: true }
    ),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Refresh timeout")), 8000)
    ),
  ])
    .then(({ data }) => {
      setToken(data.accessToken);
      return data.accessToken;
    })
    .catch((err) => {
      logger(err);
      clearToken();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      return Promise.reject(err);
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// ✅ Attach token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Response interceptor
api.interceptors.response.use(
  (response) => {
    const { method, url } = response.config;
    const isMutating = ["post", "put", "patch", "delete"].includes(method);
    const isMessage = url?.includes("/messages");

    if (isMutating && !isMessage) {
      toast.success(response?.data?.message || "Success", {
        duration: 2000,
      });
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // ❌ No token → don't try refresh
    if (!getToken()) {
      return Promise.reject(error);
    }

    // 🔁 Retry once
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    toast.error(error?.response?.data?.message || "Something went wrong", {
      duration: 3000,
    });

    return Promise.reject(error);
  }
);

export default api;
