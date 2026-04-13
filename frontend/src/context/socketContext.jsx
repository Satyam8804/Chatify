import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./authContext";
import { getToken } from "../api/axios";

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

  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

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

    const newSocket = io("https://chatify-1-8qeq.onrender.com", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      pingInterval: 10000,
      pingTimeout: 5000,
    });

    setSocket(newSocket);

    newSocket.off("connect");
    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      newSocket.emit("request-ongoing-call");
    });

    newSocket.off("disconnect");
    newSocket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    newSocket.off("reconnect");
    newSocket.on("reconnect", () => {
      // ✅ use ref — no stale closure, no socket recreation needed
      const currentChatId = activeChatIdRef.current;
      if (currentChatId) {
        newSocket.emit("join-call-room", { roomId: currentChatId });
        newSocket.emit("ping-rejoin", { chatId: currentChatId });
      }
    });

    newSocket.off("online-users");
    newSocket.on("online-users", (users) => {
      setOnlineUser(new Set(users));
    });

    // ✅ Improvement 3: explicit add() then return — avoids same-reference mutation
    newSocket.off("user-online");
    newSocket.on("user-online", ({ userId }) => {
      setOnlineUser((prev) => {
        const updated = new Set(prev);
        updated.add(userId);
        return updated;
      });
    });

    newSocket.off("user-offline");
    newSocket.on("user-offline", ({ userId }) => {
      setOnlineUser((prev) => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    });

    newSocket.off("message-notification");
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

    newSocket.off("typing");
    newSocket.on("typing", ({ chatId, user: typingUser }) => {
      setActiveChatId((current) => {
        if (chatId === current) setTypingUser(typingUser);
        return current;
      });
    });

    newSocket.off("stop-typing");
    newSocket.on("stop-typing", ({ chatId }) => {
      setActiveChatId((current) => {
        if (chatId === current) setTypingUser(null);
        return current;
      });
    });

    newSocket.off("message-seen");
    newSocket.on("message-seen", ({ chatId, userId }) => {
      setMessageSeen((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), userId],
      }));
    });

    newSocket.off("incoming-call");
    newSocket.on("incoming-call", (data) => {
      setIncomingCall((prev) => prev ?? data);
    });

    newSocket.off("call-ended");
    newSocket.on("call-ended", () => {
      setIncomingCall(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user?._id]);

  const contextValue = useMemo(
    () => ({
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
    }),
    [
      socket,
      onlineUser,
      unreadCounts,
      typingUser,
      activeChatId,
      messageSeen,
      incomingCall,
    ]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
