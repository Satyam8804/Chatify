import { useEffect, useState, useRef } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { logger } from "../../utils/logger";
import receiveSoundFile from "../../assets/sound/sent.mp3";
import seenSoundFile from "../../assets/sound/seen.mp3";
import { useAuth } from "../../context/authContext";
import VideoCall from "../call/VideoCall.jsx";

const ChatWindow = ({ chat, setSelectedChat }) => {
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isCalling, setIsCalling] = useState(false);

  const {
    socket,
    setUnreadCounts,
    setActiveChatId,
    incomingCall,
    setIncomingCall,
  } = useSocket();

  const { user } = useAuth();

  const receiveSoundRef = useRef(new Audio(receiveSoundFile));
  const seenSoundRef = useRef(new Audio(seenSoundFile));

  // ─── New Message Handler ─────────────────────────────
  const handleNewMessage = (newMessage) => {
    setMessages((prev) => {
      if (newMessage.replaceId) {
        return prev.map((msg) =>
          msg._id === newMessage.replaceId ? newMessage : msg
        );
      }

      const exists = prev.some((msg) => msg._id === newMessage._id);
      if (exists) return prev;

      return [...prev, newMessage];
    });
  };

  // ─── Chat Effect ─────────────────────────────────────
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
      if (message.sender._id === user._id) return;

      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });

      socket.emit("message-seen", { chatId: chat._id });

      receiveSoundRef.current.currentTime = 0;
      receiveSoundRef.current.play();
    };

    const handleSeen = ({ chatId, userId }) => {
      if (chatId.toString() !== chat._id.toString()) return;

      if (userId !== user._id) {
        seenSoundRef.current.currentTime = 0;
        seenSoundRef.current.play();
      }

      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          readBy: msg.readBy?.includes(userId)
            ? msg.readBy
            : [...(msg.readBy || []), userId],
        }))
      );
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("message-seen", handleSeen);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-seen", handleSeen);
      setActiveChatId(null);
    };
  }, [chat?._id, socket, user._id]);

  // ─── Call Controls ───────────────────────────────────

  const acceptCall = () => {
    if (!incomingCall) return;

    socket.emit("call-accepted", {
      to: incomingCall.from,
    });

    setIncomingCall(null);
    setIsCalling(true);
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    socket.emit("call-rejected", {
      to: incomingCall.from,
    });

    setIncomingCall(null);
  };

  // ─── UI ──────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <ChatHeader
        chat={chat}
        setSelectedChat={setSelectedChat}
        messages={messages}
        onClearChat={() => setMessages([])}
      />

      <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        <MessageList messages={messages} onReply={setReplyTo} />
      </div>

      <MessageInput
        chatId={chat._id}
        onMessageSent={handleNewMessage}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />

      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg text-center shadow-lg">
            <h3 className="text-lg font-semibold">Incoming Video Call</h3>

            <p className="text-sm text-gray-500">
              {incomingCall?.from || "Someone"} is calling...
            </p>

            <div className="flex gap-4 mt-4 justify-center">
              <button
                onClick={acceptCall}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Accept
              </button>

              <button
                onClick={rejectCall}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {isCalling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="relative w-full max-w-4xl rounded-xl bg-slate-900 p-6 shadow-2xl">
            <VideoCall
              otherUserId={
                incomingCall?.from ||
                chat?.users?.find((u) => u._id !== user._id)?._id
              }
              onEndCall={() => setIsCalling(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
