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
  refreshAccessToken,
} from "../api/axios";
import { logger } from "../utils/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);

  const intervalRef = useRef(null);

  const loaderMessages = [
    "Restoring session...",
    "Connecting securely...",
    "Syncing conversations...",
    "Almost ready...",
  ];

  const startLoaderRotation = () => {
    let i = 0;

    const el = document.getElementById("loader-text");
    if (!el) return;

    el.innerText = loaderMessages[0];

    intervalRef.current = setInterval(() => {
      const el = document.getElementById("loader-text");
      if (!el) return;

      // ✨ smooth fade effect
      el.style.opacity = "0";

      setTimeout(() => {
        i = (i + 1) % loaderMessages.length;
        el.innerText = loaderMessages[i];
        el.style.opacity = "1";
      }, 200);
    }, 800);
  };

  const stopLoaderRotation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startLoaderRotation();

    const restoreSession = async () => {
      try {
        const token = getToken();

        if (token) {
          const { data } = await api.get("/users/me");
          setUser(data.user);
        } else {
          refreshAccessToken()
            .then(async () => {
              const { data } = await api.get("/users/me");
              setUser(data.user);
            })
            .catch(() => {
              setUser(null);
            });
        }
      } catch (error) {
        logger(error);
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
        setAppReady(true);

        stopLoaderRotation();

        // final message
        const el = document.getElementById("loader-text");
        if (el) {
          el.innerText = "Almost ready...";
        }
      }
    };

    restoreSession();

    return () => stopLoaderRotation();
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post("/users/login-user", credentials);
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const loginWithToken = useCallback(async (accessToken) => {
    setToken(accessToken);
    const { data } = await api.get("/users/me");
    setUser(data.user);
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
      isAuthenticated: !!user,
      loading,
      appReady,
      login,
      loginWithToken,
      logout,
      refreshUser,
    }),
    [user, loading, appReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
