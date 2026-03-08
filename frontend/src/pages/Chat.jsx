import ChatLayout from "../components/chat/ChatLayout";
import { useAuth } from "../context/authContext";
import { useNavigate } from "react-router-dom";


const Chat = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };


  return (
    <div className="h-screen flex">
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 text-sm text-red-500"
      >
        Logout
      </button>

      {/* chat layout */}
      <ChatLayout />
    </div>
  );
};

export default Chat;
