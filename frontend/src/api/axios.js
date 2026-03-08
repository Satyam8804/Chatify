import axios from "axios";

const api = axios.create({
  baseURL: "https://chatify-jux9.onrender.com/api",
  withCredentials: true, // IMPORTANT for refresh token cookie
});

export default api;
