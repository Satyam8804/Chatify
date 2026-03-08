import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";

import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

const ChatWindow = ({ chat, setSelectedChat }) => {
  const [messages, setMessages] = useState([]);

  const { socket, setUnreadCounts, setActiveChatId } = useSocket();

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/messages/${chat._id}`);
      setMessages(res.data);
    } catch (error) {
      console.log("Fetch messages error:", error);
    }
  };

  useEffect(() => {
    if (!socket || !chat?._id) return;

    fetchMessages();

    socket.emit("join-chat", chat._id);
    setActiveChatId(chat._id);

    setUnreadCounts((prev) => ({
      ...prev,
      [chat._id]: 0,
    }));

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

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-16 bg-white flex items-center px-4">
        <ChatHeader chat={chat} setSelectedChat={setSelectedChat} />
      </div>

      {/* Messages */}
      <div className="flex-1 bg-[#ECE5DD] overflow-hidden">
        <MessageList messages={messages} />
      </div>

      {/* Input */}
      <div className="bg-white">
        <MessageInput chatId={chat._id} onMessageSent={handleNewMessage} />
      </div>
    </div>
  );
};

export default ChatWindow;
