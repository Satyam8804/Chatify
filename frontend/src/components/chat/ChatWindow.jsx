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

// ── Audio files ──────────────────────────────────────────────────────────────
// Add these two files to your assets/sound/ folder:
//   outgoing-ring.mp3  — dial tone / outgoing ring (loops)
//   incoming-ring.mp3  — ringtone for receiver (loops)
import outgoingRingFile from "../../assets/sound/outgoing-ring.mp3";
import incomingRingFile from "../../assets/sound/incoming-ring.mp3";

// ── Timer helper ─────────────────────────────────────────────────────────────
const formatDuration = (secs) => {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const ChatWindow = ({ chat, setSelectedChat }) => {
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callTargetId, setCallTargetId] = useState(null);

  // ── Call timer ──────────────────────────────────────
  const [callDuration, setCallDuration] = useState(0); // seconds
  const [callConnected, setCallConnected] = useState(false); // true once other side answers
  const timerRef = useRef(null);

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
  const videoCallRef = useRef(null); // ✅ ref to VideoCall to call cleanup()

  // ── Ringtone refs ───────────────────────────────────
  const outgoingRingRef = useRef(new Audio(outgoingRingFile));
  const incomingRingRef = useRef(new Audio(incomingRingFile));

  useEffect(() => {
    outgoingRingRef.current.loop = true;
    incomingRingRef.current.loop = true;
  }, []);

  // ── New Message Handler ─────────────────────────────
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

  // ── Timer helpers ───────────────────────────────────
  const startTimer = () => {
    setCallDuration(0);
    setCallConnected(true);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setCallDuration(0);
    setCallConnected(false);
  };

  // ── Ring timeout ref ────────────────────────────────
  const ringTimeoutRef = useRef(null);

  const clearRingTimeout = () => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  };

  // ── Start Call (caller) ─────────────────────────────
  const startCall = () => {
    if (!socket || !chat?._id) return;

    const otherUser = chat?.users?.find((u) => u._id !== user._id);
    if (!otherUser) return;

    socket.emit("video-call-user", { chatId: chat._id });

    setCallTargetId(otherUser._id);
    setIsCalling(true);
    setCallConnected(false);

    // Play outgoing ringtone until the other side answers / rejects
    outgoingRingRef.current.currentTime = 0;
    outgoingRingRef.current.play();

    // ✅ Auto-cancel if no answer within 30 seconds
    ringTimeoutRef.current = setTimeout(() => {
      outgoingRingRef.current.pause();
      outgoingRingRef.current.currentTime = 0;
      if (socket && otherUser._id) {
        socket.emit("call-ended", { to: otherUser._id });
      }
      setIsCalling(false);
      setCallTargetId(null);
    }, 30000);
  };

  // ── Shared reset — clears ALL call state ────────────
  const resetCall = () => {
    videoCallRef.current?.cleanup(); // ✅ stop camera + mic tracks
    outgoingRingRef.current.pause();
    outgoingRingRef.current.currentTime = 0;
    incomingRingRef.current.pause();
    incomingRingRef.current.currentTime = 0;
    clearRingTimeout();
    stopTimer();
    setIsCalling(false);
    setCallTargetId(null);
    setIncomingCall(null);
  };

  // ── Listen for call-accepted / call-rejected ─────────
  useEffect(() => {
    if (!socket) return;

    // Receiver accepted → stop ring, clear timeout, start timer
    const handleCallAccepted = () => {
      outgoingRingRef.current.pause();
      outgoingRingRef.current.currentTime = 0;
      clearRingTimeout();
      startTimer();
    };

    // Receiver rejected → close calling screen on caller side
    const handleCallRejected = () => {
      resetCall();
    };

    socket.on("call-accepted", handleCallAccepted);
    socket.on("call-rejected", handleCallRejected);

    return () => {
      socket.off("call-accepted", handleCallAccepted);
      socket.off("call-rejected", handleCallRejected);
    };
  }, [socket]);

  // ── Chat Effect ─────────────────────────────────────
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

    // ✅ Other user ended the call (either during ringing or mid-call)
    const handleCallEnded = () => {
      resetCall();
    };

    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-seen", handleSeen);
      socket.off("call-ended", handleCallEnded);
      setActiveChatId(null);
    };
  }, [chat?._id, socket, user._id]);

  // ── Play incoming ringtone + 30s auto-dismiss for receiver ──
  useEffect(() => {
    if (incomingCall) {
      incomingRingRef.current.currentTime = 0;
      incomingRingRef.current.play();

      // Auto-dismiss after 30s if receiver doesn't respond
      ringTimeoutRef.current = setTimeout(() => {
        incomingRingRef.current.pause();
        incomingRingRef.current.currentTime = 0;
        setIncomingCall(null);
      }, 30000);
    } else {
      incomingRingRef.current.pause();
      incomingRingRef.current.currentTime = 0;
      clearRingTimeout();
    }
  }, [incomingCall]);

  // ── Call Controls ────────────────────────────────────
  const acceptCall = () => {
    if (!incomingCall) return;

    // Stop incoming ringtone, start timer
    incomingRingRef.current.pause();
    incomingRingRef.current.currentTime = 0;

    socket.emit("call-accepted", { to: incomingCall.from });

    setCallTargetId(incomingCall.from);
    setIncomingCall(null);
    setIsCalling(true);
    startTimer();
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    socket.emit("call-rejected", { to: incomingCall.from });
    socket.emit("call-ended", { to: incomingCall.from });
    resetCall();
  };

  const endCall = () => {
    if (socket && callTargetId) {
      socket.emit("call-ended", { to: callTargetId });
    }
    resetCall();
  };

  // ── Caller display name ──────────────────────────────
  const callerName =
    chat?.users?.find((u) => u._id === incomingCall?.from)?.fName || "Someone";

  const otherUserName =
    chat?.users?.find((u) => u._id !== user._id)?.fName || "User";

  // ── UI ───────────────────────────────────────────────
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
            {/* Pulsing ring */}
            <div className="relative w-20 h-20 mx-auto mb-5">
              <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <span className="text-3xl">📹</span>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Incoming Video Call
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
              {callerName} is calling…
            </p>

            <div className="flex gap-3">
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
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    callConnected
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span className="text-sm font-medium text-slate-300">
                  {/* ✅ Show "Calling…" before connected, timer after */}
                  {callConnected
                    ? formatDuration(callDuration)
                    : `Calling ${otherUserName}…`}
                </span>
              </div>
              <button
                onClick={endCall}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                End Call
              </button>
            </div>

            <VideoCall
              ref={videoCallRef}
              otherUserId={callTargetId}
              onEndCall={endCall}
              onConnected={startTimer}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
