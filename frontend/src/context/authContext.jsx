import { createContext, useContext, useEffect, useState, useMemo } from "react";

import api from "../api/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await api.get("/users/me");

        setUser(res.data.user);
        setAccessToken(res.data.accessToken || null);
      } catch (error) {
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const res = await api.post("/users/login-user", credentials);
    console.log(res);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  };

  const logout = async () => {
    try {
      await api.post("/users/logout");
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!user,
      login,
      logout,
      loading,
    }),
    [user, accessToken, loading]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
