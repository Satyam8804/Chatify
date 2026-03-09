import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

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
  (error) => {
    const message = error?.response?.data?.message || "Something went wrong";

    toast.error(message);

    return Promise.reject(error);
  }
);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
