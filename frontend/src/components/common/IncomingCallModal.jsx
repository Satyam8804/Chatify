import { useEffect, useRef } from "react";
import { useSocket } from "../../context/socketContext";
import incomingRingFile from "../../assets/sound/incoming-ring.mp3";
import { Phone, Video, Users, PhoneOff, MessageSquare } from "lucide-react";
const IncomingCallModal = ({ onAccept, isCalling }) => {
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

  if (!incomingCall || isCalling) return null;

  const { from, callerName, chatId, isGroup, callType } = incomingCall;

  const handleAccept = () => {
    stopRing();
    setIncomingCall(null);
    onAccept?.(from, callerName || "Someone", chatId, isGroup, callType);
  };

  const handleReject = () => {
    stopRing();
    socket.emit("call-rejected", { to: from });
    setIncomingCall(null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div
        className="w-80 rounded-[28px] overflow-hidden border border-white/[0.07]"
        style={{
          background: "#0f1623",
          animation: "fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

        <div className="px-7 pt-9 pb-7 text-center">
          {/* Avatar with pulse rings */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <span className="absolute inset-[-18px] rounded-full bg-emerald-400/[0.06] animate-[ping2_2s_ease-out_0.3s_infinite]" />
            <span className="absolute inset-[-10px] rounded-full bg-emerald-400/10 animate-ping" />
            <div
              className="relative w-24 h-24 rounded-full border-2 border-emerald-400/30 flex items-center justify-center"
              style={{ background: "linear-gradient(145deg,#1a2e48,#0d1e30)" }}
            >
              {/* Swap for real avatar: <img src={callerAvatar} className="w-full h-full object-cover rounded-full" /> */}
              <span className="text-3xl font-bold text-emerald-400 tracking-tight">
                {callerName?.slice(0, 2).toUpperCase() || "??"}
              </span>
            </div>
            {/* Call type badge */}
            <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-emerald-400 border-[2.5px] border-[#0f1623] flex items-center justify-center">
              {isGroup ? (
                <Users size={11} color="#064e3b" strokeWidth={2.5} />
              ) : callType === "audio" ? (
                <Phone size={11} color="#064e3b" strokeWidth={2.5} />
              ) : (
                <Video size={11} color="#064e3b" strokeWidth={2.5} />
              )}
            </div>
          </div>

          {/* Live label */}
          <div className="inline-flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1 mb-3">
            <div className="flex items-end gap-0.5 h-3">
              {[0, 150, 300].map((d, i) => (
                <span
                  key={i}
                  className="w-0.5 bg-emerald-400 rounded-sm origin-bottom"
                  style={{
                    height: 10,
                    animation: `waveBar 0.9s ease-in-out ${d}ms infinite`,
                  }}
                />
              ))}
            </div>
            <span className="text-[11.5px] font-semibold text-emerald-400 tracking-wide">
              {isGroup
                ? "Incoming group call"
                : callType === "audio"
                ? "Incoming voice call"
                : "Incoming video call"}
            </span>
          </div>

          {/* Name + subtitle */}
          <h2 className="text-[22px] font-bold text-slate-100 tracking-tight mb-1">
            {callerName || "Someone"}
          </h2>
          <p className="text-[13px] text-slate-600 mb-8">
            Calling you · Chatify
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-4">
            {/* Decline */}
            <div className="flex flex-col items-center gap-2.5">
              <button
                onClick={handleReject}
                className="w-16 h-16 rounded-full border border-red-400/25 flex items-center justify-center transition-transform active:scale-90 hover:border-red-400/40"
                style={{ background: "#1e1018" }}
              >
                <PhoneOff size={22} color="#f87171" strokeWidth={2} />
              </button>
              <span className="text-[12px] text-slate-600 font-medium">
                Decline
              </span>
            </div>

            <div className="w-px h-8 bg-white/[0.06]" />

            {/* Accept */}
            <div className="flex flex-col items-center gap-2.5">
              <button
                onClick={handleAccept}
                className="w-16 h-16 rounded-full bg-emerald-400 flex items-center justify-center transition-transform active:scale-90 shadow-lg shadow-emerald-400/20"
              >
                {callType === "audio" ? (
                  <Phone size={22} color="#042c1a" strokeWidth={2.2} />
                ) : (
                  <Video size={22} color="#042c1a" strokeWidth={2.2} />
                )}
              </button>
              <span className="text-[12px] text-emerald-400 font-medium">
                Accept
              </span>
            </div>
          </div>

          {/* Message hint */}
          <button className="mt-6 mx-auto flex items-center gap-1.5 text-[12.5px] text-slate-600 hover:text-slate-400 transition-colors px-3 py-1.5 rounded-lg">
            <MessageSquare size={13} />
            Send a message instead
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent" />
      </div>
    </div>
  );
};

export default IncomingCallModal;
