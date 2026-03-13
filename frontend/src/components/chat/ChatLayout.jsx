import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import EmptyChatState from "./EmptyChatState";
import VideoCall from "../call/VideoCall.jsx";
import outgoingRingFile from "../../assets/sound/outgoing-ring.mp3";
import IncomingCallModal from "../common/IncomingCallModal.jsx";

const formatDuration = (secs) => {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const ChatLayout = () => {
  const [selectedChat, setSelectedChat] = useState(null);

  // ── Call state ────────────────────────────────────────
  const [isCalling, setIsCalling] = useState(false);
  const [callTargetName, setCallTargetName] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);
  const [callChatId, setCallChatId] = useState(null);
  const [callParticipants, setCallParticipants] = useState([]); // [{ userId, name }]
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [isCallerUser, setIsCallerUser] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();

  const videoCallRef = useRef(null);
  const outgoingRingRef = useRef(new Audio(outgoingRingFile));
  const timerRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  // Mirror refs — keep socket handlers fresh without re-registering
  const isCallingRef = useRef(false);
  const callChatIdRef = useRef(null);
  const participantsRef = useRef([]);

  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);
  useEffect(() => {
    callChatIdRef.current = callChatId;
  }, [callChatId]);
  useEffect(() => {
    participantsRef.current = callParticipants;
  }, [callParticipants]);
  useEffect(() => {
    outgoingRingRef.current.loop = true;
  }, []);

  // ── Timer ─────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) return; // prevent multiple timers
    setCallConnected(true);
    timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
  }, []);

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setCallDuration(0);
    setCallConnected(false);
  };

  // ── Ring ──────────────────────────────────────────────
  const stopOutgoingRing = () => {
    outgoingRingRef.current.pause();
    outgoingRingRef.current.currentTime = 0;
  };

  // ── Reset all call state ──────────────────────────────
  const resetCall = useCallback(() => {
    videoCallRef.current?.cleanup();
    stopOutgoingRing();
    clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    stopTimer();

    if (socket && callChatIdRef.current) {
      socket.emit("leave-call-room", { roomId: callChatIdRef.current });
    }

    setIsCalling(false);
    setCallTargetName("");
    setCallChatId(null);
    setCallParticipants([]);
    setIsGroupCall(false);

    isCallingRef.current = false;
    callChatIdRef.current = null;
    participantsRef.current = [];

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [socket]);

  // ── Socket handlers ───────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // 1-to-1: caller hears back that receiver accepted
    const onCallAccepted = () => {
      stopOutgoingRing();
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
      document.documentElement.requestFullscreen().catch(() => {});
      startTimer();
    };

    const onCallRejected = () => resetCall();
    const onCallEnded = () => resetCall();

    socket.on("call-accepted", onCallAccepted);
    socket.on("call-rejected", onCallRejected);
    socket.on("call-ended", onCallEnded);

    return () => {
      socket.off("call-accepted", onCallAccepted);
      socket.off("call-rejected", onCallRejected);
      socket.off("call-ended", onCallEnded);
    };
  }, [socket, resetCall, startTimer]);

  // ── startCall — called from ChatHeader via ChatWindow ─
  const startCall = useCallback(
    (chat) => {
      // 🛑 Prevent spam clicking
      if (isCallingRef.current) return;

      if (!socket || !chat?._id) return;

      const isGroup = !!chat.isGroupChat;
      const otherUsers = chat.users?.filter((u) => u._id !== user._id) || [];
      if (!otherUsers.length) return;

      const receiverIds = otherUsers.map((u) => u._id);

      const participants = otherUsers.map((u) => ({
        userId: u._id,
        name: u.fName || "User",
      }));

      const chatName = isGroup
        ? chat.chatName || "Group Call"
        : otherUsers[0].fName || "User";

      // Notify users
      socket.emit("video-call-user", {
        chatId: chat._id,
        receiverIds,
        isGroup,
      });

      setCallChatId(chat._id);
      setCallParticipants(participants);
      setIsGroupCall(isGroup);
      setCallTargetName(chatName);
      setIsCalling(true);
      setCallConnected(false);
      setIsCallerUser(true);
      callChatIdRef.current = chat._id;
      isCallingRef.current = true;
      participantsRef.current = participants;

      if (!isGroup) {
        // ── 1-to-1 call ──
        outgoingRingRef.current.currentTime = 0;
        outgoingRingRef.current.play();

        ringTimeoutRef.current = setTimeout(() => {
          socket.emit("call-ended", { to: receiverIds[0] });
          resetCall();
        }, 30000);
      } else {
        // ── Group call ──
        socket.emit("join-call-room", { roomId: chat._id });
      }
    },
    [socket, user, resetCall, startTimer]
  );

  // ── acceptCall — called from IncomingCallModal ────────
  const acceptCall = useCallback(
    (callerId, callerName, chatId, isGroup) => {
      setCallChatId(chatId);
      setCallTargetName(callerName || "User");
      setIsGroupCall(!!isGroup);
      setIsCalling(true);

      callChatIdRef.current = chatId;
      isCallingRef.current = true;

      setIsCallerUser(false);

      // 🔥 IMPORTANT
      socket.emit("join-call-room", { roomId: chatId });

      if (isGroup) {
        setCallParticipants([]);
        startTimer();
      } else {
        setCallParticipants([{ userId: callerId, name: callerName }]);
        socket.emit("call-accepted", { to: callerId });
      }
    },
    [socket, startTimer]
  );

  // ── endCall — called from VideoCall end button ────────
  const endCall = useCallback(() => {
    if (socket) {
      if (isGroupCall) {
        socket.emit("call-ended", { roomId: callChatIdRef.current });
      } else {
        const targetId = participantsRef.current[0]?.userId;
        if (targetId) socket.emit("call-ended", { to: targetId });
      }
    }
    resetCall();
  }, [socket, isGroupCall, resetCall]);

  return (
    <div className="h-screen w-full flex bg-gray-100 dark:bg-slate-950 transition-colors">
      {/* ── Sidebar ── */}
      <div
        className={`${
          selectedChat ? "hidden md:block" : "block"
        } w-full md:w-80 bg-white dark:bg-slate-900 shrink-0`}
      >
        <Sidebar
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
        />
      </div>

      {/* ── Chat / Empty ── */}
      <div
        className={`${
          selectedChat ? "block" : "hidden md:block"
        } flex-1 bg-gray-100 dark:bg-slate-950 min-w-0`}
      >
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            setSelectedChat={setSelectedChat}
            startCall={startCall}
            isCalling={isCalling}
          />
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* ── Incoming call modal ── */}
      <IncomingCallModal
        onAccept={(callerId, callerName, chatId, isGroup) =>
          acceptCall(callerId, callerName, chatId, isGroup)
        }
      />

      {/* ── Video call overlay ── */}
      {isCalling && (
        <div className="fixed inset-0 z-[100] bg-slate-950 h-[100dvh] w-[100vw]">
          <div className="relative w-full h-[calc(100dvh-48px)]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full animate-pulse ${
                    callConnected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-sm font-medium text-slate-300">
                  {callConnected
                    ? formatDuration(callDuration)
                    : `Calling ${callTargetName}…`}
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
              participants={callParticipants}
              chatId={callChatId}
              isGroup={isGroupCall}
              onEndCall={endCall}
              onConnected={startTimer}
              isCaller={isCallerUser}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatLayout;
