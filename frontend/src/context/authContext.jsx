import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import api, {
  setToken,
  clearToken,
  getToken,
  setSilent,
  refreshAccessToken,
} from "../api/axios";
import { logger } from "../utils/logger";

const AuthContext = createContext(null);

const LOADER_MESSAGES = [
  "Restoring session...",
  "Connecting securely...",
  "Syncing conversations...",
  "Almost ready...",
  "Waking up server...",
  "Almost there...",
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const intervalRef = useRef(null);

  const setLoaderText = (text) => {
    const el = document.getElementById("loader-text");
    if (!el) return;
    el.style.opacity = "0";
    setTimeout(() => {
      el.innerText = text;
      el.style.opacity = "1";
    }, 200);
  };

  const startLoaderRotation = () => {
    let i = 0;
    const el = document.getElementById("loader-text");
    if (!el) return;
    el.innerText = LOADER_MESSAGES[0];
    intervalRef.current = setInterval(() => {
      const el = document.getElementById("loader-text");
      if (!el) return;
      el.style.opacity = "0";
      setTimeout(() => {
        i = (i + 1) % LOADER_MESSAGES.length;
        el.innerText = LOADER_MESSAGES[i];
        el.style.opacity = "1";
      }, 200);
    }, 2500);
  };

  const stopLoaderRotation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startLoaderRotation();
    setSilent(true); // suppress toasts during restore

    const restoreSession = async () => {
      try {
        // Step 1: get a fresh access token if none in memory
        if (!getToken()) {
          setLoaderText("Refreshing session...");
          await refreshAccessToken();
        }

        // Step 2: fetch the user with the token
        setLoaderText("Syncing conversations...");
        const { data } = await api.get("/users/me");
        setUser(data.user);
      } catch (err) {
        // Refresh or /me failed — user must log in again
        logger("Session restore failed:", err);
        clearToken();
        setUser(null);
      } finally {
        setSilent(false);
        setLoading(false);
        setAppReady(true);
        stopLoaderRotation();
      }
    };

    restoreSession();
    return () => stopLoaderRotation();
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post("/users/login-user", credentials);
    setToken(data.accessToken);
    setUser(data.user);
    return data;
  }, []);

  const loginWithToken = useCallback(async (accessToken) => {
    setToken(accessToken);
    const { data } = await api.get("/users/me");
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/users/logout");
    } catch (error) {
      logger(error);
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/users/me");
      setUser(data.user);
    } catch (error) {
      logger(error);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAuthenticated: !!user,
      loading,
      appReady,
      login,
      loginWithToken,
      logout,
      refreshUser,
    }),
    [user, loading, appReady, login, loginWithToken, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);