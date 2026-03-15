import ChatLayout from "../components/chat/ChatLayout";
import { useAuth } from "../context/authContext";

const Chat = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="h-screen flex bg-white dark:bg-slate-900 transition-colors">
      <ChatLayout />
    </div>
  );
};

export default Chat;
