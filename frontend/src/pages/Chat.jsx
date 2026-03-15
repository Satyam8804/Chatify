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
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        if (prev === loadingMessages.length - 1) {
          clearInterval(interval);
          setTimeout(() => setShowLoader(false), 800); // small delay before entering chat
          return prev;
        }
        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  if (loading || showLoader) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900 transition-colors">
        {/* Logo */}
        <img
          src={logo}
          alt="Chatify"
          className="w-16 h-16 object-contain mb-4"
        />

        {/* App name */}
        <h1 className="text-2xl font-bold text-emerald-500 mb-4">Chatify</h1>

        {/* Spinner */}
        <Loader className="w-10 h-10 animate-spin text-emerald-500 mb-4" />

        {/* Loading text */}
        <p
          key={messageIndex}
          className="text-gray-700 dark:text-slate-300 text-sm transition-all duration-300"
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
