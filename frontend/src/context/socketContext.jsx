import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./authContext";
import { getToken } from "../api/axios"; // ✅ read from memory
import { logger } from "../utils/logger";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth(); // ✅ depend on user, not accessToken

  const [socket, setSocket] = useState(null);
  const [onlineUser, setOnlineUser] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});
  const [typingUser, setTypingUser] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);

  useEffect(() => {
    if (!user?._id) return; // ✅ wait for user

    const token = getToken(); // ✅ from memory
    if (!token) return;

    const newSocket = io("https://chatify-jux9.onrender.com", {
      auth: { token },
      autoConnect: true,
      transports: ["websocket"],
    });

    setSocket(newSocket);

    newSocket.on("connect", () => logger("🟢 Socket connected:", newSocket.id));
    newSocket.on("connect_error", (err) =>
      logger("❌ Socket connect error:", err.message)
    );
    newSocket.on("online-users", (users) => setOnlineUser(new Set(users)));

    newSocket.on("user-online", ({ userId }) => {
      setOnlineUser((prev) => new Set(prev).add(userId));
    });

    newSocket.on("user-offline", ({ userId }) => {
      setOnlineUser((prev) => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    });

    newSocket.on("message-notification", ({ chatId }) => {
      if (chatId !== activeChatId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || 0) + 1,
        }));
      }
    });

    newSocket.on("typing", ({ chatId, user }) => {
      if (chatId === activeChatId) setTypingUser(user);
    });

    newSocket.on("stop-typing", ({ chatId }) => {
      if (chatId === activeChatId) setTypingUser(null);
    });

    newSocket.on("message-seen", ({ chatId, userId }) => {
      logger("Message seen:", chatId, userId);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user?._id, activeChatId]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUser,
        unreadCounts,
        setUnreadCounts,
        typingUser,
        activeChatId,
        setActiveChatId,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
