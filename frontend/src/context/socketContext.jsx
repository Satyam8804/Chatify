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

  const activeChatIdRef = useRef(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    if (!user?._id) {
      socket?.disconnect();
      setSocket(null);
      return;
    }

    const token = getToken();
    if (!token) return;

    const newSocket = io("https://chatify-jux9.onrender.com", {
      auth: { token },
      transports: ["websocket"],
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("request-ongoing-call");
    });

    newSocket.on("reconnect", () => {
      const chatId = activeChatIdRef.current;
      if (chatId) {
        newSocket.emit("join-call-room", { roomId: chatId });
        newSocket.emit("ping-rejoin", { chatId });
      }
    });

    newSocket.on("incoming-call", (data) => {
      setIncomingCall(data); // ✅ FIXED
    });

    newSocket.on("call-ended", () => {
      setIncomingCall(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user?._id]); // ✅ FIXED (no activeChatId)

  const value = useMemo(
    () => ({
      socket,
      onlineUser,
      unreadCounts,
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
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
