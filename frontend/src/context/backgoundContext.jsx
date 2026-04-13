import { createContext, useContext, useState, useCallback } from "react";
import {
  createPresetBackground,
  getAllPresetBackgrounds,
  updatePresetBackground,
  togglePresetBackground,
  deletePresetBackground,
} from "../api/background.api.js";

const BackgroundContext = createContext();

export const BackgroundProvider = ({ children }) => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchPresets = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const { data } = await getAllPresetBackgrounds(filters);
      setPresets(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const addPreset = async (formData) => {
    setUploading(true);
    try {
      const { data } = await createPresetBackground(formData);
      setPresets((prev) => [data, ...prev]);
      return true;
    } catch {
      return false;
    } finally {
      setUploading(false);
    }
  };

  const editPreset = async (id, formData) => {
    setUploading(true);
    try {
      const { data } = await updatePresetBackground(id, formData);
      setPresets((prev) => prev.map((p) => (p._id === id ? data : p)));
      return true;
    } catch {
      return false;
    } finally {
      setUploading(false);
    }
  };

  const togglePreset = async (id) => {
    try {
      const { data } = await togglePresetBackground(id);
      setPresets((prev) => prev.map((p) => (p._id === id ? data : p)));
    } catch {}
  };

  const removePreset = async (id) => {
    try {
      await deletePresetBackground(id);
      setPresets((prev) => prev.filter((p) => p._id !== id));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <BackgroundContext.Provider
      value={{
        presets,
        loading,
        uploading,
        fetchPresets,
        addPreset,
        editPreset,
        togglePreset,
        removePreset,
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
};

export const useBackground = () => useContext(BackgroundContext);