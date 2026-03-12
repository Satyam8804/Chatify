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
  const [callTargetId, setCallTargetId] = useState(null); // ✅ fix 1: declare state

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

  // ─── Start Call (caller) ─────────────────────────────
  const startCall = () => {
    if (!socket || !chat?._id) return;

    const otherUser = chat?.users?.find((u) => u._id !== user._id);
    if (!otherUser) return;

    socket.emit("video-call-user", { chatId: chat._id });

    setCallTargetId(otherUser._id); // ✅ stores who we're calling
    setIsCalling(true); // ✅ opens video UI for caller
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

    socket.emit("call-accepted", { to: incomingCall.from });

    setCallTargetId(incomingCall.from); // ✅ fix 2: save before clearing incomingCall
    setIncomingCall(null);
    setIsCalling(true);
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    socket.emit("call-rejected", { to: incomingCall.from });
    setIncomingCall(null);
  };

  const endCall = () => {
    setIsCalling(false);
    setCallTargetId(null);
  };

  // ─── Caller display name ─────────────────────────────
  const callerName =
    chat?.users?.find((u) => u._id === incomingCall?.from)?.fName || "Someone";

  // ─── UI ──────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <ChatHeader
        chat={chat}
        setSelectedChat={setSelectedChat}
        messages={messages}
        onClearChat={() => setMessages([])}
        startCall={startCall}
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

      {/* ── Incoming call modal ── */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl text-center shadow-2xl w-80 border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📹</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Incoming Video Call
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
              {callerName} is calling…
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={rejectCall}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-700 dark:text-slate-300 hover:text-red-600 font-medium text-sm transition-colors"
              >
                Decline
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-500/25"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active video call ── */}
      {isCalling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-slate-300">
                  Live call
                </span>
              </div>
              <button
                onClick={endCall}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                End Call
              </button>
            </div>

            {/* ✅ fix 3: always use callTargetId — never null for both caller and receiver */}
            <VideoCall otherUserId={callTargetId} onEndCall={endCall} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
