import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true, // IMPORTANT for refresh token cookie
});

export default api;
