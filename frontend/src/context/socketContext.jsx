import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./authContext";
import { getToken } from "../api/axios";
import { logger } from "../utils/logger";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();

  const [socket, setSocket] = useState(null);
  const [onlineUser, setOnlineUser] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});
  const [typingUser, setTypingUser] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messageSeen, setMessageSeen] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!user?._id) {
      socket?.disconnect();

      queueMicrotask(() => {
        setSocket(null);
        setOnlineUser(new Set());
        setUnreadCounts({});
        setIncomingCall(null);
      });

      return;
    }

    const token = getToken();
    if (!token) return;

    const newSocket = io("https://chatify-jux9.onrender.com", {
      auth: { token },
      transports: ["websocket"],
      pingInterval: 10000,
      pingTimeout: 5000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on("online-users", (users) => {
      setOnlineUser(new Set(users));
    });

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
      setActiveChatId((current) => {
        if (chatId !== current) {
          setUnreadCounts((prev) => ({
            ...prev,
            [chatId]: (prev[chatId] || 0) + 1,
          }));
        }
        return current;
      });
    });

    newSocket.on("typing", ({ chatId, user: typingUser }) => {
      setActiveChatId((current) => {
        if (chatId === current) setTypingUser(typingUser);
        return current;
      });
    });

    newSocket.on("stop-typing", ({ chatId }) => {
      setActiveChatId((current) => {
        if (chatId === current) setTypingUser(null);
        return current;
      });
    });

    newSocket.on("message-seen", ({ chatId, userId }) => {
      setMessageSeen((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), userId],
      }));
    });

    newSocket.on("incoming-call", (data) => {
      setIncomingCall((prev) => prev ?? data);
    });

    newSocket.on("call-ended", () => {
      setIncomingCall(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user?._id]);
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
        messageSeen,
        incomingCall,
        setIncomingCall,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
