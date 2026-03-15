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

const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;

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

      // redirect only if not already on login
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

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const { method, url } = response.config;
    const isMutating = ["post", "put", "patch", "delete"].includes(method);
    const isMessage = url?.includes("/messages");

    if (isMutating && !isMessage) {
      toast.success(response?.data?.message || "Success");
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // 🚨 FIX: if no token → do not try refresh
    if (!getToken()) {
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    toast.error(error?.response?.data?.message || "Something went wrong");
    return Promise.reject(error);
  }
);

export default api;
