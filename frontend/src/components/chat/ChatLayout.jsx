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

  // ✅ Responsive detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Sidebar resize ──
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

  // ── Drag handlers ──
  const onMouseDown = useCallback(
    (e) => {
      if (isMobile) return;

      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = sidebarWidth;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth, isMobile]
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

      localStorage.setItem("sidebarWidth", String(sidebarWidth));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mouseleave", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mouseleave", onMouseUp);
    };
  }, [sidebarWidth]);

  // ── Timer ──
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

  // ── Ring ──
  const playRing = useCallback(() => {
    const audio = outgoingRingRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    audio.loop = true;
    audio.play().catch(() => {});
  }, []);

  const stopRing = useCallback(() => {
    const audio = outgoingRingRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }, []);

  // ── Reset call ──
  const resetCall = useCallback(() => {
    videoCallRef.current?.cleanup?.();

    stopRing();
    stopTimer();

    clearTimeout(ringTimeoutRef.current);

    setIsCalling(false);
    setCallTargetName("");
    setCallChatId(null);
    setIsGroupCall(false);
    setInitiator(null);

    localStorage.removeItem("ongoingCall");
  }, [stopRing, stopTimer]);

  // ── Start call ──
  const startCall = useCallback(
    (chat, type = "video") => {
      if (isCallingRef.current || !chat?._id) return;

      const others = chat.users?.filter((u) => u._id !== user._id) || [];
      if (!others.length) return;

      callSavedRef.current = false;
      callTypeRef.current = type;
      callChatIdRef.current = chat._id;
      isCallingRef.current = true;

      setInitiator({ isInitiator: true });
      setCallChatId(chat._id);
      setCallTargetName(others[0].fName || "User");
      setIsCalling(true);
      setCallType(type);

      localStorage.setItem(
        "ongoingCall",
        JSON.stringify({ chatId: chat._id, type })
      );

      receiverIdRef.current = others[0]._id;
      playRing();

      ringTimeoutRef.current = setTimeout(() => {
        resetCall();
      }, 30000);
    },
    [user, playRing, resetCall]
  );

  const endCall = useCallback(() => {
    resetCall();
  }, [resetCall]);

  return (
    <div className="h-screen w-full flex bg-gray-100 dark:bg-slate-950 overflow-hidden">
      {/* ── Sidebar ── */}
      <div
        className={`${
          selectedChat ? "hidden md:block" : "block"
        } w-full md:w-auto bg-white dark:bg-slate-900 shrink-0`}
        style={{
          width: isMobile ? "100%" : sidebarWidth,
        }}
      >
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            chats={chats}
            setChats={setChats}
            onStartCall={startCall}
          />
        </Suspense>
      </div>

      {/* ── Drag Handle ── */}
      {!isMobile && (
        <div
          onMouseDown={onMouseDown}
          className="hidden md:flex w-2 cursor-col-resize items-center justify-center relative"
        >
          <div className="absolute inset-y-0 -left-3 -right-3 cursor-col-resize" />
          <div className="w-px h-full bg-gray-300 dark:bg-gray-600" />
        </div>
      )}

      {/* ── Chat Window ── */}
      <div
        className={`${
          selectedChat ? "block" : "hidden md:block"
        } flex-1 min-w-0`}
      >
        {selectedChat ? (
          <Suspense fallback={<Loader text="Opening chat..." />}>
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

      {/* ── Incoming Call ── */}
      <IncomingCallModal isCalling={isCalling} />

      {/* ── Video Call ── */}
      {isCalling && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col h-screen">
          <div className="flex justify-between p-4 bg-slate-900">
            <span className="truncate max-w-[180px] text-white">
              {callConnected
                ? formatDuration(callDuration)
                : `Calling ${callTargetName}`}
            </span>

            <button onClick={endCall} className="text-red-400 font-semibold">
              End
            </button>
          </div>

          <div className="flex-1">
            <VideoCall
              ref={videoCallRef}
              chatId={callChatId}
              chats={chats}
              onEndCall={endCall}
              onConnected={startTimer}
              initiator={initiator}
              callType={callType}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatLayout;
