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

  // ── Call state lives here so video UI works from any screen ──
  const [isCalling, setIsCalling] = useState(false);
  const [callTargetId, setCallTargetId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);

  // name to show in header while calling
  const [callTargetName, setCallTargetName] = useState("");

  const { socket } = useSocket();
  const { user } = useAuth();

  const videoCallRef = useRef(null);
  const outgoingRingRef = useRef(new Audio(outgoingRingFile));
  const timerRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  // mirror refs — keep socket handlers fresh without re-registering
  const callTargetIdRef = useRef(null);
  const isCallingRef = useRef(false);

  useEffect(() => {
    callTargetIdRef.current = callTargetId;
  }, [callTargetId]);
  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);

  useEffect(() => {
    outgoingRingRef.current.loop = true;
  }, []);

  // ── Helpers ──────────────────────────────────────────────────
  const stopOutgoingRing = () => {
    outgoingRingRef.current.pause();
    outgoingRingRef.current.currentTime = 0;
  };

  const clearRingTimeout = () => {
    clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
  };

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setCallDuration(0);
    setCallConnected(true);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setCallDuration(0);
    setCallConnected(false);
  };

  const resetCall = useCallback(() => {
    videoCallRef.current?.cleanup();
    stopOutgoingRing();
    clearRingTimeout();
    stopTimer();
    setIsCalling(false);
    setCallTargetId(null);
    setCallTargetName("");
    isCallingRef.current = false;
    callTargetIdRef.current = null;
  }, []);

  // ── Socket handlers ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onCallAccepted = () => {
      stopOutgoingRing();
      clearRingTimeout();
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

  // ── startCall — called from ChatWindow via prop ──────────────
  const startCall = useCallback(
    (chat) => {
      if (!socket || !chat?._id) return;
      const otherUser = chat.users?.find((u) => u._id !== user._id);
      if (!otherUser) return;

      socket.emit("video-call-user", {
        receiverId: otherUser._id,
      });
      document.documentElement.requestFullscreen().catch(() => {});

      setCallTargetId(otherUser._id);
      callTargetIdRef.current = otherUser._id;
      setCallTargetName(otherUser.fName || "User");
      setIsCalling(true);
      isCallingRef.current = true;
      setCallConnected(false);

      outgoingRingRef.current.currentTime = 0;
      outgoingRingRef.current.play();

      ringTimeoutRef.current = setTimeout(() => {
        socket.emit("call-ended", { to: callTargetIdRef.current });
        resetCall();
      }, 30000);
    },
    [socket, user, resetCall]
  );

  const acceptCall = useCallback(
    (callerId, callerName) => {
      setCallTargetId(callerId);
      callTargetIdRef.current = callerId;
      setCallTargetName(callerName || "User");
      setIsCalling(true);
      isCallingRef.current = true;
      startTimer();
    },
    [startTimer]
  );

  const endCall = useCallback(() => {
    if (socket && callTargetIdRef.current) {
      socket.emit("call-ended", { to: callTargetIdRef.current });
    }
    resetCall();
    document.exitFullscreen().catch(() => {});
  }, [socket, resetCall]);

  return (
    <div className="h-screen w-full flex bg-gray-100 dark:bg-slate-950 transition-colors">
      {/* Sidebar */}
      <div
        className={`
        ${selectedChat ? "hidden md:block" : "block"}
        w-full md:w-80 bg-white dark:bg-slate-900 shrink-0
      `}
      >
        <Sidebar
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
        />
      </div>

      {/* Chat / Empty */}
      <div
        className={`
        ${selectedChat ? "block" : "hidden md:block"}
        flex-1 bg-gray-100 dark:bg-slate-950 min-w-0
      `}
      >
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            setSelectedChat={setSelectedChat}
            startCall={startCall} // ← pass down, ChatWindow just calls it
          />
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* ── Incoming call modal — works from any screen ── */}
      <IncomingCallModal
        onAccept={(callerId, callerName) => acceptCall(callerId, callerName)}
      />

      {/* ── Video call overlay — renders over everything ── */}
      {isCalling && (
        <div className="fixed inset-0 z-[100] bg-slate-950 h-[100dvh] w-[100vw]">
          <div className="relative w-full h-[calc(100dvh-48px)]">
            {/* Header bar */}
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

export default ChatLayout;
