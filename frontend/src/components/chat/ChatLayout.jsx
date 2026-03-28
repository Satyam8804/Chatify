import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import EmptyChatState from "./EmptyChatState";
import VideoCall from "../call/VideoCall.jsx";
import outgoingRingFile from "../../assets/sound/outgoing-ring.mp3";
import IncomingCallModal from "../common/IncomingCallModal.jsx";
import api from "../../api/axios.js";

import { lazy, Suspense } from "react";
import Loader from "../../utils/Loader";
import SidebarSkeleton from "../../utils/SidebarSkeleton.jsx";

const Sidebar = lazy(() => import("./Sidebar.jsx"));
const ChatWindow = lazy(() => import("./ChatWindow.jsx"));

const formatDuration = (secs) => {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const SIDEBAR_DEFAULT_WIDTH = 320;
const SIDEBAR_MIN_WIDTH = 260;
const SIDEBAR_MAX_WIDTH = 520;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const ChatLayout = () => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callTargetName, setCallTargetName] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [callConnected, setCallConnected] = useState(false);
  const [callChatId, setCallChatId] = useState(null);
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [chats, setChats] = useState([]);
  const [initiator, setInitiator] = useState(null);
  const [callType, setCallType] = useState("video");
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isDesktop, setIsDesktop] = useState(true);

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
  const callDurationRef = useRef(0);
  const callConnectedRef = useRef(false);
  const initiatorRef = useRef(null);
  const audioCtxRef = useRef(null);

  const sidebarResizeRef = useRef({
    active: false,
    startX: 0,
    startWidth: SIDEBAR_DEFAULT_WIDTH,
  });

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      setIsDesktop(window.innerWidth >= 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    const call = JSON.parse(localStorage.getItem("ongoingCall"));

    if (call?.chatId && chats.length > 0) {
      console.log("♻️ Restoring call in chat");

      const chat = chats.find((c) => c._id === call.chatId);

      if (chat) {
        setSelectedChat(chat);

        setCallChatId(call.chatId);
        setIsCalling(true);
        setCallType(call.type || "video");

        setCallTargetName(
          chat.users?.find((u) => u._id !== user._id)?.fName || "User"
        );
      }
    }
  }, [chats, user?._id]);

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

  useEffect(() => {
    return () => {
      outgoingRingRef.current?.pause();
      outgoingRingRef.current = null;
    };
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
    const participants = videoCallRef.current?.getParticipants?.() || [];

    if (participants.length === 1 && receiverIdRef.current) {
      return [
        {
          _id: receiverIdRef.current,
        },
      ];
    }

    return participants;
  }, []);

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
    setCallType("video");
    isCallingRef.current = false;
    callChatIdRef.current = null;
    isGroupCallRef.current = false;
    receiverIdRef.current = null;
    initiatorRef.current = null;
    localStorage.removeItem("ongoingCall");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [stopTimer, stopRing]);

  const saveCallLog = useCallback(
    async (status, duration = 0) => {
      if (callSavedRef.current || !initiatorRef.current?.isInitiator) return;
      callSavedRef.current = true;

      const participants = getParticipants();

      await api.post("/messages/call", {
        chatId: callChatIdRef.current,
        callType: callTypeRef.current,
        status,
        duration,
        participants: isGroupCallRef.current
          ? participants.length > 0
            ? participants
            : initiatorRef.current?.receiverIds?.map((id) => {
                const user = chats
                  ?.flatMap((c) => c.users || [])
                  .find((u) => String(u._id) === String(id));

                return {
                  _id: id,
                  fName: user?.fName,
                  lName: user?.lName,
                  avatar: user?.avatar,
                };
              }) || []
          : (() => {
              const user = chats
                ?.flatMap((c) => c.users || [])
                .find((u) => String(u._id) === String(receiverIdRef.current));

              return [
                {
                  _id: receiverIdRef.current,
                  fName: user?.fName,
                  lName: user?.lName,
                  avatar: user?.avatar,
                },
              ];
            })(),
        receiverId: receiverIdRef.current,
      });
    },
    [getParticipants, chats]
  );

  useEffect(() => {
    if (!socket) return;

    const onAccepted = () => {
      stopRing();
      clearTimeout(ringTimeoutRef.current);
    };

    const onRejected = async ({ chatId, from }) => {
      console.log("❌ User rejected:", from, "chat: ", chatId);

      stopRing();
      clearTimeout(ringTimeoutRef.current);

      if (String(chatId) !== String(callChatIdRef.current)) return;

      if (!isGroupCallRef.current) {
        await saveCallLog("rejected", 0);
        resetCall();
      }
    };

    const onBusy = async () => {
      stopRing();
      clearTimeout(ringTimeoutRef.current);
      await saveCallLog("missed", 0);
      resetCall();
      alert("User is busy on another call");
    };

    const onEnded = async () => {
      if (isGroupCallRef.current) return;
      await saveCallLog(
        callConnectedRef.current ? "completed" : "missed",
        callDurationRef.current
      );
      resetCall();
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
  }, [socket, resetCall, saveCallLog]);

  const startCall = useCallback(
    (chat, type = "video") => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      audioCtxRef.current.resume();

      if (isCallingRef.current || !socket || !chat?._id) return;

      const isGroup = !!chat.isGroupChat || isGroupCallRef.current;
      const others = chat.users?.filter((u) => u._id !== user._id) || [];
      if (!others.length) return;

      const receiverIds = others.map((u) => u._id);

      callSavedRef.current = false;
      callTypeRef.current = type;
      callChatIdRef.current = chat._id;
      isCallingRef.current = true;
      isGroupCallRef.current = isGroup;
      initiatorRef.current = { isInitiator: true, receiverIds, isGroup };

      setInitiator({ isInitiator: true, receiverIds, isGroup });
      setCallChatId(chat._id);
      setIsGroupCall(isGroup);
      setCallTargetName(others[0].fName || "User");
      setIsCalling(true);
      setCallType(type);

      localStorage.setItem(
        "ongoingCall",
        JSON.stringify({
          chatId: chat._id,
          type,
        })
      );

      if (!isGroup) {
        receiverIdRef.current = receiverIds[0];
        playRing();

        ringTimeoutRef.current = setTimeout(async () => {
          socket.emit("call-ended", {
            roomId: chat._id,
            isGroup: false,
          });
          await saveCallLog("missed", 0);
          resetCall();
        }, 30000);
      }
    },
    [socket, user, saveCallLog, resetCall, playRing]
  );

  const acceptCall = useCallback(
    (callerId, callerName, chatId, isGroup, callType) => {
      callSavedRef.current = false;
      callTypeRef.current = callType || "video";
      callChatIdRef.current = chatId;
      isCallingRef.current = true;
      isGroupCallRef.current = isGroup;
      initiatorRef.current = { isInitiator: false };
      setCallType(callType || "video");
      setCallChatId(chatId);
      setCallTargetName(callerName);
      setIsGroupCall(isGroup);
      setIsCalling(true);
      setInitiator({ isInitiator: false });

      localStorage.setItem(
        "ongoingCall",
        JSON.stringify({
          chatId,
          type: callType,
        })
      );

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
        socket.emit("call-ended", {
          roomId: callChatIdRef.current,
          isGroup: isGroupCallRef.current,
        });
      }
    }

    await saveCallLog(
      callConnectedRef.current ? "completed" : "missed",
      callDurationRef.current
    );

    resetCall();
  }, [socket, saveCallLog, resetCall]);

  const joinCall = useCallback(
    (chat, type = "video") => {
      if (!socket || socket.disconnected) return;
      if (isCallingRef.current || !chat?._id) return;

      const isGroup = !!chat.isGroupChat || isGroupCallRef.current;

      callSavedRef.current = false;
      callTypeRef.current = type;
      callChatIdRef.current = chat._id;
      isCallingRef.current = true;
      isGroupCallRef.current = isGroup;
      initiatorRef.current = { isInitiator: false };

      setInitiator({ isInitiator: false });
      setCallChatId(chat._id);
      setIsGroupCall(isGroup);
      setCallType(type);
      setIsCalling(true);
      setCallTargetName("");

      socket.emit("join-call-room", {
        roomId: chat._id,
      });

      socket.emit("ping-rejoin", {
        chatId: chat._id,
      });

      localStorage.setItem(
        "ongoingCall",
        JSON.stringify({ chatId: chat._id, type })
      );
    },
    [socket]
  );

  const startSidebarResize = useCallback(
    (e) => {
      if (!isDesktop) return;

      e.preventDefault();
      e.stopPropagation();

      sidebarResizeRef.current.active = true;
      sidebarResizeRef.current.startX = e.clientX;
      sidebarResizeRef.current.startWidth = sidebarWidth;

      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [isDesktop, sidebarWidth]
  );

  const handleSidebarResizeMove = useCallback((e) => {
    if (!sidebarResizeRef.current.active) return;

    const deltaX = e.clientX - sidebarResizeRef.current.startX;
    const nextWidth = clamp(
      sidebarResizeRef.current.startWidth + deltaX,
      SIDEBAR_MIN_WIDTH,
      SIDEBAR_MAX_WIDTH
    );

    setSidebarWidth(nextWidth);
  }, []);

  const stopSidebarResize = useCallback(() => {
    if (!sidebarResizeRef.current.active) return;

    sidebarResizeRef.current.active = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handleSidebarResizeMove);
    window.addEventListener("pointerup", stopSidebarResize);
    window.addEventListener("pointercancel", stopSidebarResize);

    return () => {
      window.removeEventListener("pointermove", handleSidebarResizeMove);
      window.removeEventListener("pointerup", stopSidebarResize);
      window.removeEventListener("pointercancel", stopSidebarResize);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [handleSidebarResizeMove, stopSidebarResize]);

  const sidebarStyle = isDesktop
    ? { width: `${sidebarWidth}px` }
    : { width: "100%" };

  return (
    <div className="h-screen w-full flex bg-gray-100 dark:bg-slate-950 transition-colors">
      {/* Sidebar */}
      <div
        className={`${
          selectedChat ? "hidden md:block" : "block"
        } relative shrink-0 overflow-hidden bg-white dark:bg-slate-900`}
        style={sidebarStyle}
      >
        <Suspense fallback={<SidebarSkeleton fullscreen={false} />}>
          <Sidebar
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            setChats={setChats}
            chats={chats}
            onStartCall={startCall}
            onJoinCall={joinCall}
          />
        </Suspense>

        {/* Drag handle */}
        <div
          onPointerDown={startSidebarResize}
          className="absolute right-0 top-0 z-20 hidden h-full w-2 cursor-col-resize touch-none md:flex items-stretch justify-center"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        >
          <div className="h-full w-[2px] bg-transparent transition-colors hover:bg-sky-500/50" />
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={`${
          selectedChat ? "block" : "hidden md:block"
        } flex-1 items-center justify-between bg-gray-100 dark:bg-slate-950 min-w-0`}
      >
        {selectedChat ? (
          <Suspense
            fallback={<Loader text="Opening chat..." fullscreen={false} />}
          >
            <ChatWindow
              chat={selectedChat}
              setSelectedChat={setSelectedChat}
              startCall={startCall}
              isCalling={isCalling}
            />
          </Suspense>
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* Incoming Call Modal */}
      <IncomingCallModal
        isCalling={isCalling}
        onAccept={(callerId, callerName, chatId, isGroup, callType) =>
          acceptCall(callerId, callerName, chatId, isGroup, callType)
        }
      />

      {/* Video Call Overlay */}
      {isCalling && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950 flex flex-col"
          style={{ height: "100dvh" }}
        >
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                    callConnected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className="text-sm font-medium text-slate-300 font-mono tabular-nums"
                  style={{ minWidth: "6.5rem" }}
                >
                  {callConnected
                    ? formatDuration(callDuration)
                    : `Calling ${callTargetName}…`}
                </span>
              </div>
            </div>

            <button
              onClick={endCall}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              End Call
            </button>
          </div>

          {/* Video Call */}
          <div className="flex-1 min-h-0 w-full">
            <Suspense
              fallback={<Loader text="Connecting call..." fullscreen={false} />}
            >
              <VideoCall
                ref={videoCallRef}
                chatId={callChatId}
                chats={chats}
                onEndCall={endCall}
                onConnected={startTimer}
                initiator={initiator}
                callType={callType}
                setIsGroupCall={setIsGroupCall}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatLayout;
