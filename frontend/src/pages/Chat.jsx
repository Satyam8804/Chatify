import { useEffect } from "react";
import ChatLayout from "../components/chat/ChatLayout";
import { useTheme } from "../context/themeContext";

const Chat = () => {
  const {theme} = useTheme()
  useEffect(() => {
    console.log("Theme changed:", theme);
  }, [theme]);

  return (
    <div className="h-screen flex">
      <ChatLayout />
    </div>
  );
};

export default Chat;
