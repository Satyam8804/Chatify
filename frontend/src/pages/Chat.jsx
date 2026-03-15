import { Loader } from "lucide-react";
import ChatLayout from "../components/chat/ChatLayout";
import { useAuth } from "../context/authContext";
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

const loadingMessages = [
  "Preparing your chats...",
  "Connecting securely...",
  "Syncing conversations...",
  "Almost ready...",
];

const Chat = () => {
  const { user, loading } = useAuth();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    console.log("Auth loading:", loading);
    console.log("User:", user);
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 700);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 transition-colors">
        {/* Logo */}
        <img
          src={logo}
          alt="Chatify"
          className="w-16 h-16 object-contain mb-4 drop-shadow-lg drop-shadow-emerald-500/40"
        />

        {/* App Name */}
        <h1 className="text-2xl font-bold text-emerald-500 mb-6 tracking-wide">
          Chatify
        </h1>

        {/* Spinner */}
        <Loader className="w-10 h-10 animate-spin text-emerald-500 mb-5" />

        <p
          key={messageIndex}
          className="text-gray-800 dark:text-slate-300 text-sm font-medium animate-pulse"
        >
          {loadingMessages[messageIndex]}
        </p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex bg-white dark:bg-slate-900 transition-colors">
      <ChatLayout />
    </div>
  );
};

export default Chat;
