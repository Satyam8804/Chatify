import { Loader } from "lucide-react";
import ChatLayout from "../components/chat/ChatLayout";
import { useAuth } from "../context/authContext";

const Chat = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;
  if (!user) return null;
  return (
    <div className="h-screen flex bg-white dark:bg-slate-900 transition-colors">
      <ChatLayout />
    </div>
  );
};

export default Chat;
