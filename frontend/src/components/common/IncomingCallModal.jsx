import { useEffect, useRef } from "react";
import { useSocket } from "../../context/socketContext";
import incomingRingFile from "../../assets/sound/incoming-ring.mp3";

const IncomingCallModal = ({ onAccept }) => {
  const { socket, incomingCall, setIncomingCall } = useSocket();

  const incomingRingRef = useRef(new Audio(incomingRingFile));
  const ringTimeoutRef = useRef(null);

  useEffect(() => {
    incomingRingRef.current.loop = true;
  }, []);

  const stopRing = () => {
    incomingRingRef.current.pause();
    incomingRingRef.current.currentTime = 0;
    clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
  };

  useEffect(() => {
    if (!incomingCall) {
      stopRing();
      return;
    }
    incomingRingRef.current.currentTime = 0;
    incomingRingRef.current.play().catch(() => {});
    ringTimeoutRef.current = setTimeout(() => {
      stopRing();
      setIncomingCall(null);
    }, 30000);
    return () => stopRing();
  }, [incomingCall]);

  useEffect(() => {
    if (!socket) return;
    const handle = () => {
      stopRing();
      setIncomingCall(null);
    };
    socket.on("call-ended", handle);
    return () => socket.off("call-ended", handle);
  }, [socket]);

  if (!incomingCall) return null;

  const { from, callerName, chatId, isGroup } = incomingCall;

  const handleAccept = () => {
    stopRing();
    setIncomingCall(null);
    onAccept?.(from, callerName || "Someone", chatId, isGroup);
  };

  const handleReject = () => {
    stopRing();
    socket.emit("call-rejected", { to: from });
    setIncomingCall(null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl text-center shadow-2xl w-80 border border-slate-200 dark:border-slate-700">
        <div className="relative w-20 h-20 mx-auto mb-5">
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <span className="text-3xl">📹</span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {isGroup ? "Incoming Group Call" : "Incoming Video Call"}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
          {callerName || "Someone"} is calling…
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-700 dark:text-slate-300 hover:text-red-600 font-medium text-sm transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-500/25"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
