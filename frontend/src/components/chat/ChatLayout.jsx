import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import EmptyChatState from "./EmptyChatState";
import VideoCall from "../call/VideoCall.jsx";
import outgoingRingFile from "../../assets/sound/outgoing-ring.mp3";
import IncomingCallModal from "../common/IncomingCallModal.jsx";
import api from "../../api/axios.js";

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
  const [chats, setChats] = useState([]);

  const { socket } = useSocket();
  const { user } = useAuth();

  const videoCallRef = useRef(null);
  const outgoingRingRef = useRef(new Audio(outgoingRingFile));
  const timerRef = useRef(null);
  const ringTimeoutRef = useRef(null);

  const callTypeRef = useRef("video");
  const callSavedRef = useRef(false);

  const isCallingRef = useRef(false);
  const callChatIdRef = useRef(null);
  const isGroupCallRef = useRef(false);
  const receiverIdRef = useRef(null);

  // ✅ refs to avoid stale closures in endCall
  const callDurationRef = useRef(0);
  const callConnectedRef = useRef(false);

  const [initiator, setInitiator] = useState(null);

  // sync refs
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
    callConnectedRef.current = true;
    setCallConnected(true);
    timerRef.current = setInterval(() => {
      setCallDuration((p) => {
        callDurationRef.current = p + 1;
        return p + 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    callDurationRef.current = 0;
    callConnectedRef.current = false;
    setCallDuration(0);
    setCallConnected(false);
  }, []);

  const getParticipants = useCallback(() => {
    if (!isGroupCallRef.current) return [];
    const chat = chats.find(
      (c) => String(c._id) === String(callChatIdRef.current)
    );
    return chat?.users?.map((u) => u._id) || [];
  }, [chats]);

  const playRing = useCallback(() => {
    const audio = outgoingRingRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  const stopRing = useCallback(() => {
    const audio = outgoingRingRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const resetCall = useCallback(() => {
    callSavedRef.current = false;
    videoCallRef.current?.cleanup?.();
    stopRing();
    clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    stopTimer();
    setIsCalling(false);
    setCallTargetName("");
    setCallChatId(null);
    setIsGroupCall(false);
    setInitiator(null);
    isCallingRef.current = false;
    callChatIdRef.current = null;
    isGroupCallRef.current = false;
    receiverIdRef.current = null;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [stopTimer, stopRing]);

  useEffect(() => {
    if (!socket) return;

    const onAccepted = () => {
      stopRing();
      clearTimeout(ringTimeoutRef.current);
    };

    const onRejected = async () => {
      if (!callChatIdRef.current) return;
      stopRing();
      clearTimeout(ringTimeoutRef.current); 
      if (!callSavedRef.current) {
        callSavedRef.current = true;
        await api.post("/messages/call", {
          chatId: callChatIdRef.current,
          callType: callTypeRef.current,
          status: "rejected",
          duration: 0,
          participants: getParticipants(),
          receiverId: receiverIdRef.current,
        });
      }
      resetCall(); 
    };

    const onBusy = () => {
      stopRing();
      alert("User is busy on another call");
      resetCall();
    };

    const onEnded = () => {
      if (!isGroupCallRef.current) resetCall();
    };

    socket.on("call-accepted", onAccepted);
    socket.on("call-rejected", onRejected);
    socket.on("user-busy", onBusy);
    socket.on("call-ended", onEnded);

    return () => {
      socket.off("call-accepted", onAccepted);
      socket.off("call-rejected", onRejected);
      socket.off("user-busy", onBusy);
      socket.off("call-ended", onEnded);
    };
  }, [socket, resetCall, getParticipants]);

  const startCall = useCallback(
    (chat, type = "video") => {
      if (isCallingRef.current || !socket || !chat?._id) return;

      callTypeRef.current = type;

      const isGroup = !!chat.isGroupChat;
      const others = chat.users?.filter((u) => u._id !== user._id) || [];
      if (!others.length) return;

      const receiverIds = others.map((u) => u._id);

      setInitiator({ isInitiator: true, receiverIds, isGroup });
      setCallChatId(chat._id);
      setIsGroupCall(isGroup);
      setCallTargetName(others[0].fName || "User");
      setIsCalling(true);

      callChatIdRef.current = chat._id;
      isCallingRef.current = true;
      isGroupCallRef.current = isGroup;

      if (!isGroup) {
        receiverIdRef.current = receiverIds[0];

        socket.emit("call-user", { to: receiverIds[0], chatId: chat._id });
        playRing();

        ringTimeoutRef.current = setTimeout(async () => {
          socket.emit("call-ended", { to: receiverIds[0] });

          if (!callSavedRef.current) {
            callSavedRef.current = true;
            await api.post("/messages/call", {
              chatId: chat._id,
              callType: callTypeRef.current,
              status: "missed",
              duration: 0,
              participants: [],
              receiverId: receiverIds[0], // ✅ use local var, ref may be cleared
            });
          }
          resetCall();
        }, 30000);
      }
    },
    [socket, user, getParticipants, resetCall, playRing]
  );

  const acceptCall = useCallback(
    (callerId, callerName, chatId, isGroup) => {
      setCallChatId(chatId);
      setCallTargetName(callerName);
      setIsGroupCall(isGroup);
      setIsCalling(true);

      callChatIdRef.current = chatId;
      isCallingRef.current = true;
      isGroupCallRef.current = isGroup;

      setInitiator({ isInitiator: false });

      if (!isGroup) {
        receiverIdRef.current = callerId;
        socket.emit("call-accepted", { to: callerId });
      }
    },
    [socket]
  );

  const endCall = useCallback(async () => {
    if (!callChatIdRef.current) return;

    if (socket) {
      if (isGroupCallRef.current) {
        socket.emit("leave-call-room", { roomId: callChatIdRef.current });
      } else {
        socket.emit("call-ended", { to: receiverIdRef.current });
      }
    }

    // ✅ only initiator saves the log
    if (!callSavedRef.current && initiator?.isInitiator) {
      callSavedRef.current = true;
      await api.post("/messages/call", {
        chatId: callChatIdRef.current,
        callType: callTypeRef.current,
        status: callConnectedRef.current ? "completed" : "missed",
        duration: callDurationRef.current,
        participants: getParticipants(),
        receiverId: receiverIdRef.current,
      });
    }

    resetCall();
  }, [socket, getParticipants, resetCall, initiator]);

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
          setChats={setChats}
          chats={chats}
          onStartCall={startCall}
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

      <IncomingCallModal
        isCalling={isCalling}
        onAccept={(callerId, callerName, chatId, isGroup) =>
          acceptCall(callerId, callerName, chatId, isGroup)
        }
      />

      {isCalling && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950 flex flex-col"
          style={{ height: "100dvh" }}
        >
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5 shrink-0">
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
              onClick={() => endCall()}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              End Call
            </button>
          </div>

          <div className="flex-1 min-h-0 w-full">
            <VideoCall
              ref={videoCallRef}
              chatId={callChatId}
              chats={chats}
              onEndCall={endCall}
              onConnected={startTimer}
              initiator={initiator}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatLayout;
