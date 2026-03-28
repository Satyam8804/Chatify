import {
  useState,
  useRef,
  useEffect,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useSocket } from "../../context/socketContext.jsx";
import { useAuth } from "../../context/authContext.jsx";
import Loader from "../../utils/Loader";
import SidebarSkeleton from "../../utils/SidebarSkeleton.jsx";
import VideoCall from "../call/VideoCall.jsx";
import IncomingCallModal from "../common/IncomingCallModal.jsx";
import EmptyChatState from "./EmptyChatState";
import outgoingRingFile from "../../assets/sound/outgoing-ring.mp3";
import api from "../../api/axios.js";

const Sidebar = lazy(() => import("./Sidebar.jsx"));
const ChatWindow = lazy(() => import("./ChatWindow.jsx"));

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;

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
  const [initiator, setInitiator] = useState(null);
  const [callType, setCallType] = useState("video");

  // ── Resizable sidebar ──
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("sidebarWidth");
    return saved ? Number(saved) : DEFAULT_WIDTH;
  });
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

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

  // ── Drag handlers ──
  const onMouseDown = useCallback(
    (e) => {
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = sidebarWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth]
  );

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - dragStartXRef.current;
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, dragStartWidthRef.current + delta)
      );
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(
        "sidebarWidth",
        String(
          Math.round(
            Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidthRef.current))
          )
        )
      );
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Persist width on change
  useEffect(() => {
    localStorage.setItem("sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const call = JSON.parse(localStorage.getItem("ongoingCall"));
    if (call?.chatId && chats.length > 0) {
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
      return [{ _id: receiverIdRef.current }];
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
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
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
                const u = chats
                  ?.flatMap((c) => c.users || [])
                  .find((u) => String(u._id) === String(id));
                return {
                  _id: id,
                  fName: u?.fName,
                  lName: u?.lName,
                  avatar: u?.avatar,
                };
              }) || []
          : (() => {
              const u = chats
                ?.flatMap((c) => c.users || [])
                .find((u) => String(u._id) === String(receiverIdRef.current));
              return [
                {
                  _id: receiverIdRef.current,
                  fName: u?.fName,
                  lName: u?.lName,
                  avatar: u?.avatar,
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
      if (!audioCtxRef.current)
        audioCtxRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
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
        JSON.stringify({ chatId: chat._id, type })
      );
      if (!isGroup) {
        receiverIdRef.current = receiverIds[0];
        playRing();
        ringTimeoutRef.current = setTimeout(async () => {
          socket.emit("call-ended", { roomId: chat._id, isGroup: false });
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
        JSON.stringify({ chatId, type: callType })
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
      socket.emit("join-call-room", { roomId: chat._id });
      socket.emit("ping-rejoin", { chatId: chat._id });
      localStorage.setItem(
        "ongoingCall",
        JSON.stringify({ chatId: chat._id, type })
      );
    },
    [socket]
  );

  return (
    <div className="h-screen w-full flex bg-gray-100 dark:bg-slate-950 transition-colors overflow-hidden">
      {/* ── Sidebar ── */}
      <div
        className={`${
          selectedChat ? "hidden md:block" : "block"
        } w-full md:w-80 bg-white dark:bg-slate-900 shrink-0`}
        
        style={{ width: sidebarWidth }}
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
      </div>

      {/* ── Drag handle ── */}
      <div
        onMouseDown={onMouseDown}
        className="hidden md:flex w-1 shrink-0 cursor-col-resize items-center justify-center group relative"
      >
        {/* Invisible wider hit area */}
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        {/* Visible line — shows on hover/drag */}
        <div className="w-px h-full bg-emerald-400/40 dark:bg-emerald-500/30 group-hover:bg-emerald-400 dark:group-hover:bg-emerald-500 transition-colors duration-150" />
        {/* Grip dots */}
        <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-emerald-400 dark:bg-emerald-500"
            />
          ))}
        </div>
      </div>

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

      {/* ── Incoming call modal ── */}
      <IncomingCallModal
        isCalling={isCalling}
        onAccept={(callerId, callerName, chatId, isGroup, callType) =>
          acceptCall(callerId, callerName, chatId, isGroup, callType)
        }
      />

      {/* ── Video call overlay ── */}
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
