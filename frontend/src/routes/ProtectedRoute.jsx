import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

const loadingMessages = [
  "Preparing your chats...",
  "Connecting securely...",
  "Syncing conversations...",
  "Almost ready...",
];

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900">
        {/* Logo */}
        <img
          src={logo}
          alt="Chatify"
          className="w-16 h-16 object-contain mb-4"
        />

        {/* App Name */}
        <h1 className="text-2xl font-bold text-emerald-500 mb-4">Chatify</h1>

        {/* Spinner */}
        <Loader className="w-10 h-10 animate-spin text-emerald-500 mb-4" />

        {/* Rotating loading message */}
        <p
          key={messageIndex}
          className="text-gray-700 dark:text-slate-300 text-sm transition-all duration-300"
        >
          {loadingMessages[messageIndex]}
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
