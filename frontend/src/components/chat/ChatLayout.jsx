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
  const [isCalling, setIsCalling] = useState(false);
  const [callTargetName, setCallTargetName] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);
  const [callChatId, setCallChatId] = useState(null);
  const [isGroupCall, setIsGroupCall] = useState(false);

  const { socket } = useSocket();
  const { user } = useAuth();

  const videoCallRef = useRef(null);
  const outgoingRingRef = useRef(new Audio(outgoingRingFile));
  const timerRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  // mirror refs for use inside socket handlers
  const isCallingRef = useRef(false);
  const callChatIdRef = useRef(null);
  const isGroupCallRef = useRef(false);
  const receiverIdRef = useRef(null); // ✅ tracks 1-to-1 receiver

  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);
  useEffect(() => {
    callChatIdRef.current = callChatId;
  }, [callChatId]);
  useEffect(() => {
    isGroupCallRef.current = isGroupCall;
  }, [isGroupCall]);
  useEffect(() => {
    outgoingRingRef.current.loop = true;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    setCallConnected(true);
    timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
  }, []);

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setCallDuration(0);
    setCallConnected(false);
  };

  const stopOutgoingRing = () => {
    outgoingRingRef.current.pause();
    outgoingRingRef.current.currentTime = 0;
  };

  const resetCall = useCallback(() => {
    videoCallRef.current?.cleanup();
    stopOutgoingRing();
    clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    stopTimer();

    setIsCalling(false);
    setCallTargetName("");
    setCallChatId(null);
    setIsGroupCall(false);

    isCallingRef.current = false;
    callChatIdRef.current = null;
    isGroupCallRef.current = false;
    receiverIdRef.current = null;

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onCallAccepted = () => {
      stopOutgoingRing();
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
      document.documentElement.requestFullscreen().catch(() => {});
      startTimer();
    };

    const onCallRejected = () => resetCall();

    const onCallEnded = () => {
      if (!isGroupCallRef.current) resetCall();
    };

    socket.on("call-accepted", onCallAccepted);
    socket.on("call-rejected", onCallRejected);
    socket.on("call-ended", onCallEnded);

    return () => {
      socket.off("call-accepted", onCallAccepted);
      socket.off("call-rejected", onCallRejected);
      socket.off("call-ended", onCallEnded);
    };
  }, [socket, resetCall, startTimer]);

  const startCall = useCallback(
    (chat) => {
      if (isCallingRef.current || !socket || !chat?._id) return;

      const isGroup = !!chat.isGroupChat;
      const otherUsers = chat.users?.filter((u) => u._id !== user._id) || [];
      if (!otherUsers.length) return;

      const receiverIds = otherUsers.map((u) => u._id);
      const chatName = isGroup
        ? chat.chatName || "Group Call"
        : otherUsers[0].fName || "User";

      socket.emit("video-call-user", {
        chatId: chat._id,
        receiverIds,
        isGroup,
      });

      setCallChatId(chat._id);
      setIsGroupCall(isGroup);
      setCallTargetName(chatName);
      setIsCalling(true);
      setCallConnected(false);

      callChatIdRef.current = chat._id;
      isCallingRef.current = true;
      isGroupCallRef.current = isGroup;

      if (!isGroup) {
        receiverIdRef.current = receiverIds[0]; // ✅ store for endCall
        outgoingRingRef.current.currentTime = 0;
        outgoingRingRef.current.play();
        ringTimeoutRef.current = setTimeout(() => {
          socket.emit("call-ended", { to: receiverIds[0] });
          resetCall();
        }, 30000);
      }
    },
    [socket, user, resetCall]
  );

  const acceptCall = useCallback(
    (callerId, callerName, chatId, isGroup) => {
      setCallChatId(chatId);
      setCallTargetName(callerName || "User");
      setIsGroupCall(!!isGroup);
      setIsCalling(true);

      callChatIdRef.current = chatId;
      isCallingRef.current = true;
      isGroupCallRef.current = !!isGroup;

      // Join the call room so server will send existing-participants
      socket.emit("join-call-room", { roomId: chatId });

      if (!isGroup) {
        receiverIdRef.current = callerId;
        socket.emit("call-accepted", { to: callerId });
      } else {
        startTimer();
      }
    },
    [socket, startTimer]
  );

  const endCall = useCallback(() => {
    if (socket) {
      if (isGroupCallRef.current) {
        socket.emit("leave-call-room", { roomId: callChatIdRef.current });
      } else if (receiverIdRef.current) {
        socket.emit("call-ended", { to: receiverIdRef.current }); // ✅ uses ref
      }
    }
    resetCall();
  }, [socket, resetCall]);

  const friends = selectedChat?.users?.filter((u) => u._id !== user._id) || [];

  return (
    <div className="h-screen w-full flex bg-gray-100 dark:bg-slate-950 transition-colors">
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

      {/* ✅ hide incoming call modal if already in a call */}
      <IncomingCallModal
        isCalling={isCalling}
        onAccept={(callerId, callerName, chatId, isGroup) =>
          acceptCall(callerId, callerName, chatId, isGroup)
        }
      />

      {isCalling && (
        <div className="fixed inset-0 z-[100] bg-slate-950 h-[100dvh] w-[100vw]">
          <div className="relative w-full h-[calc(100dvh-48px)]">
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
              chatId={callChatId}
              chat={selectedChat}
              friends={friends}
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
