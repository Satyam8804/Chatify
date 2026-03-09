import axios from "axios";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

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

    // TOKEN EXPIRED → TRY REFRESH
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/users/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newToken = res.data.accessToken;

        localStorage.setItem("accessToken", newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        logger(refreshError)
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
      }
    }

    const message =
      error?.response?.data?.message || "Something went wrong";

    toast.error(message);

    return Promise.reject(error);
  }
);

export default api;