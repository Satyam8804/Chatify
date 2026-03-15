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

  // rotate loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // minimum splash screen duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  if (loading || showLoader) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900">
        <img src={logo} alt="Chatify" className="w-16 h-16 mb-4" />

        <h1 className="text-2xl font-bold text-emerald-500 mb-4">Chatify</h1>

        <Loader className="w-10 h-10 animate-spin text-emerald-500 mb-4" />

        <p className="text-gray-700 dark:text-slate-300 text-sm">
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
