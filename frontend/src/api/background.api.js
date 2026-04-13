import api from "./axios.js";

export const createPresetBackground = (formData) =>
  api.post("/backgrounds/admin", formData);

export const getAllPresetBackgrounds = (params) =>
  api.get("/backgrounds/admin", { params });

export const updatePresetBackground = (id, formData) =>
  api.put(`/backgrounds/admin/${id}`, formData);

export const togglePresetBackground = (id) =>
  api.patch(`/backgrounds/admin/${id}/toggle`);

export const deletePresetBackground = (id) =>
  api.delete(`/backgrounds/admin/${id}`);

export const uploadCustomBackground = (formData) =>
  api.post("/backgrounds/upload", formData);

export const getMyUploadedBackgrounds = () =>
  api.get("/backgrounds/my-uploads");

export const deleteCustomBackground = (id) =>
  api.delete(`/backgrounds/my-uploads/${id}`);

export const setDefaultBackground = (data) =>
  api.patch("/backgrounds/default", data);

export const setChatBackground = (chatId, data) =>
  api.patch(`/backgrounds/chat/${chatId}`, data);

export const getBackgroundsForPicker = () =>
  api.get("/backgrounds/picker");