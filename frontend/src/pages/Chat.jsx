import { useEffect, useRef } from "react";
import ChatLayout from "../components/chat/ChatLayout";
import { useAuth } from "../context/authContext";

const Chat = () => {
  const { user } = useAuth();

  // ✅ Listen for the Android back button press dispatched by App.jsx.
  // We forward it to ChatLayout via a custom ref callback so ChatLayout
  // can close the active chat panel and show the contacts list instead.
  const chatLayoutRef = useRef(null);

  useEffect(() => {
    const handleBack = () => {
      // If ChatLayout exposes a closeChat method via the ref, call it.
      // This collapses the chat panel → shows the sidebar (contacts list).
      if (chatLayoutRef.current?.closeChat) {
        chatLayoutRef.current.closeChat();
      }
    };

    window.addEventListener("chatify:backpress", handleBack);
    return () => window.removeEventListener("chatify:backpress", handleBack);
  }, []);

  if (!user) return null;

  return (
    <div className="h-screen flex bg-white dark:bg-slate-900 transition-colors">
      <ChatLayout ref={chatLayoutRef} />
    </div>
  );
};

export default Chat;
