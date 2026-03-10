// ChatWindow.jsx
import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { logger } from "../../utils/logger";

const ChatWindow = ({ chat, setSelectedChat }) => {
  const [messages, setMessages] = useState([]);
  const { socket, setUnreadCounts, setActiveChatId } = useSocket();

  const handleNewMessage = (newMessage) => {
    setMessages((prev) => {
      if (newMessage.replaceId) {
        return prev.map((msg) =>
          msg._id === newMessage.replaceId ? newMessage : msg
        );
      }
      return [...prev, newMessage];
    });
  };

  useEffect(() => {

    if (!socket || !chat?._id) {
      return;
    }

    setMessages([]);

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/messages/${chat._id}`);
        console.log("chat._id:", chat._id);
        console.log("response:", res.data);
        setMessages(res.data);
      } catch (error) {
        logger("Fetch messages error:", error);
      }
    };

    fetchMessages();
    socket.emit("join-chat", chat._id);
    setActiveChatId(chat._id);
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));
    socket.emit("message-seen", { chatId: chat._id });

    const handleReceiveMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleSeen = ({ chatId, userId }) => {
      if (chatId !== chat._id) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.chat === chatId && msg.sender._id === userId) {
            const alreadySeen = msg.readBy?.includes(userId);
            return {
              ...msg,
              readBy: alreadySeen
                ? msg.readBy
                : [...(msg.readBy || []), userId],
            };
          }
          return msg;
        })
      );
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("message-seen", handleSeen);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-seen", handleSeen);
      setActiveChatId(null);
    };
  }, [chat?._id, socket]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <ChatHeader chat={chat} setSelectedChat={setSelectedChat} messages={messages} />

      {/* Messages */}
      <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        <MessageList messages={messages} />
      </div>

      {/* Input */}
      <MessageInput chatId={chat._id} onMessageSent={handleNewMessage} />
    </div>
  );
};

export default ChatWindow;
