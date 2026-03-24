import { useEffect } from "react";
import { useAuth } from "../context/authContext.jsx";

const AppWrapper = ({ children }) => {
  const { appReady } = useAuth();

  useEffect(() => {
    if (!appReady) return;

    const loader = document.getElementById("loader");

    if (loader) {
      loader.style.opacity = "0";
      loader.style.transition = "opacity 0.4s ease";

      setTimeout(() => loader.remove(), 400);
    }
  }, [appReady]);

  return children;
};

export default AppWrapper;