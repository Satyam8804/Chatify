import { useEffect, useState, useRef } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { logger } from "../../utils/logger";

import receiveSoundFile from "../../assets/sound/seen.mp3";
import seenSoundFile from "../../assets/sound/sent.mp3";

import { useAuth } from "../../context/authContext";

const ChatWindow = ({ chat, setSelectedChat, startCall, isCalling }) => {
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);

  const receiveSoundRef = useRef(new Audio(receiveSoundFile));
  const seenSoundRef = useRef(new Audio(seenSoundFile));

  const chatRef = useRef(chat);
  useEffect(() => {
    chatRef.current = chat; // keeps ref fresh on every render
  }, [chat]);

  const { socket, setUnreadCounts, setActiveChatId } = useSocket();
  const { user, setUser } = useAuth();

  const handleNewMessage = (newMessage) => {
    setMessages((prev) => {
      if (newMessage.replaceId)
        return prev.map((msg) =>
          msg._id === newMessage.replaceId ? newMessage : msg
        );
      if (prev.some((msg) => msg._id === newMessage._id)) return prev;
      return [...prev, newMessage];
    });
  };

  useEffect(() => {
    if (!socket || !chat?._id) return;

    setMessages([]);
    setReplyTo(null);
    setActiveChatId(chat._id);
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/messages/${chat._id}`);
        setMessages(res.data);
      } catch (error) {
        logger("Fetch messages error:", error);
      }
    };

    fetchMessages();
    socket.emit("join-chat", chat._id);
    socket.emit("message-seen", { chatId: chat._id });

    const handleReceiveMessage = (message) => {
      console.log("receive-message fired", {
        messageType: message.messageType,
        callData: message.callData,
        chatId: message.chat?._id || message.chat,
        currentChatId: chat._id,
      });
      const senderId = message.sender?._id || message.sender;
      const isOwnMessage = String(senderId) === String(user?._id); // ✅ safe compare

      if (isOwnMessage && message.messageType !== "call") return;

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === message._id)) return prev;
        return [...prev, message];
      });

      if (!isOwnMessage) {
        socket.emit("message-seen", { chatId: chat._id });
        receiveSoundRef.current.currentTime = 0;
        receiveSoundRef.current.play().catch(() => {});
      }
    };

    const handleCallLog = (message) => {
      const incomingChatId = message.chat?._id || message.chat;
      if (String(incomingChatId) !== String(chat._id)) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    };

    const handleSeen = ({ chatId, userId }) => {
      if (chatId.toString() !== chat._id.toString()) return;

      setMessages((prev) =>
        prev.map((msg) => {
          const alreadySeen = msg.readBy?.includes(userId);

          // ✅ play sound only once for your message
          if (!alreadySeen && msg.sender?._id === user?._id) {
            seenSoundRef.current.currentTime = 0;
            seenSoundRef.current.play().catch(() => {});
          }

          return {
            ...msg,
            readBy: alreadySeen ? msg.readBy : [...(msg.readBy || []), userId],
          };
        })
      );
    };

    const handleMessageDeleted = ({
      messageId,
      deletedPermanently,
      updatedMessage,
    }) => {
      setMessages((prev) =>
        deletedPermanently
          ? prev.filter((m) => m._id !== messageId)
          : prev.map((m) => (m._id === messageId ? updatedMessage : m))
      );
    };

    const handleBlockStatusChanged = ({ byUserId, isBlocked }) => {
      const latestChat = chatRef.current; // ✅ always fresh

      if (!latestChat?.users || latestChat.isGroupChat) return;

      const currentFriend = latestChat.users.find(
        (u) => u._id?.toString() !== user._id?.toString()
      );

      if (!currentFriend || byUserId !== currentFriend._id.toString()) return;

      setSelectedChat((prev) => {
        if (!prev?.users) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u._id.toString() === byUserId
              ? {
                  ...u,
                  blockedUsers: isBlocked
                    ? [...(u.blockedUsers || []), user._id.toString()]
                    : (u.blockedUsers || []).filter(
                        (id) => id.toString() !== user._id.toString()
                      ),
                }
              : u
          ),
        };
      });
    };

    socket.on("block-status-changed", handleBlockStatusChanged);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("message-seen", handleSeen);
    socket.on("call-log-saved", handleCallLog);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-seen", handleSeen);
      socket.off("call-log-saved", handleCallLog);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("block-status-changed", handleBlockStatusChanged); // ✅
      setActiveChatId(null); // ✅ now runs
    };
  }, [chat?._id, socket, user?._id]); // ✅ safe access in deps

  if (!chat || !chat.users) return null;

  const friend = !chat.isGroupChat
    ? chat.users?.find((u) => u._id?.toString() !== user._id?.toString())
    : null;

  const isBlockedByMe = user?.blockedUsers
    ?.map((id) => id.toString())
    .includes(friend?._id?.toString());

  const isBlockedByThem = friend?.blockedUsers
    ?.map((id) => id.toString())
    .includes(user?._id?.toString());

  const handleDeleteMessage = async (messageId) => {
    try {
      const res = await api.delete(`/messages/${messageId}`); // removed extra /api/
      const { deletedPermanently, updatedMessage } = res.data;

      setMessages(
        (prev) =>
          deletedPermanently
            ? prev.filter((m) => m._id !== messageId) // hard delete → remove
            : prev.map((m) => (m._id === messageId ? updatedMessage : m)) // soft delete → update
      );
    } catch (err) {
      console.error("Delete message error:", err);
    }
  };

  const handleUnblock = async () => {
    try {
      const res = await api.patch("/users/block", { userId: friend._id }); // ✅ correct route
      setUser((prev) => ({ ...prev, blockedUsers: res.data.blockedUsers })); // ✅ sync context
    } catch (err) {
      console.error("Unblock failed:", err);
    }
  };

  const backgroundUrl =
    chat?.backgroundOverride?.backgroundRef?.assetUrl ||
    user?.defaultBackground?.backgroundRef?.assetUrl ||
    null;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <ChatHeader
        chat={chat}
        setSelectedChat={setSelectedChat}
        messages={messages}
        onClearChat={() => setMessages([])}
        startCall={startCall}
        isCalling={isCalling}
        isBlockedByMe={isBlockedByMe} // ✅ add
        isBlockedByThem={isBlockedByThem}
      />

      <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        <MessageList
          messages={messages}
          onReply={setReplyTo}
          onStartCall={startCall}
          chat={chat}
          onDeleteMessage={handleDeleteMessage}
          backgroundUrl={backgroundUrl} // ← add this
        />
      </div>

      <MessageInput
        chatId={chat._id}
        onMessageSent={handleNewMessage}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        isBlockedByMe={isBlockedByMe}
        isBlockedByThem={isBlockedByThem}
        onUnblock={handleUnblock}
      />
    </div>
  );
};

export default ChatWindow;
