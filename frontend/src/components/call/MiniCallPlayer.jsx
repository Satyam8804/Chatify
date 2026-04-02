import { useRef, useState, useEffect, useCallback } from "react";
import {
  PhoneOff,
  Maximize2,
  MicOff,
  Mic,
  VideoOff,
  Phone,
} from "lucide-react";

const formatDuration = (secs) => {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const getInitialPos = () => ({
  x: Math.max(window.innerWidth - 208, 16),
  y: Math.max(window.innerHeight - 320, 16),
});


const MiniCallPlayer = ({
  callTargetName,
  callConnected,
  callDuration,
  callType,
  localStream,
  remoteStreams = [],
  isMuted,
  isVideoOff,
  onMaximize,
  onEndCall,
  onToggleMute,
}) => {
  const [pos, setPos] = useState(getInitialPos);
  const [visible, setVisible] = useState(false); // mount-in animation
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const startPtr = useRef({ x: 0, y: 0 });
  const livePos = useRef(pos);
  const rafId = useRef(null);

  // ── Mount-in animation ───────────────────────────────────────────────────
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Attach video stream ──────────────────────────────────────────────────
  // Prefer the first remote stream (show who you're talking to).
  // Fall back to local stream so the mini window is never empty.
  const displayStream = remoteStreams[0]?.stream || localStream;
  const isLocal = !remoteStreams[0]?.stream;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !displayStream || callType === "audio") return;

    if (video.srcObject !== displayStream) {
      video.srcObject = displayStream;
      video.play().catch(() => {});
    }

    return () => {
      // Don't null srcObject here — the stream lives in VideoCall and is still
      // needed there. Just leave it; GC handles the reference.
    };
  }, [displayStream, callType]);

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.target.closest("button")) return; // let button clicks through
    e.preventDefault();

    dragging.current = true;
    hasDragged.current = false;
    setIsDragging(true);

    const rect = containerRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    startPtr.current = { x: e.clientX, y: e.clientY };
    containerRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;

    const dx = Math.abs(e.clientX - startPtr.current.x);
    const dy = Math.abs(e.clientY - startPtr.current.y);
    if (dx > 4 || dy > 4) hasDragged.current = true;
    if (!hasDragged.current) return;

    const el = containerRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.min(
      Math.max(e.clientX - offset.current.x, 8),
      vw - el.offsetWidth - 8
    );
    const y = Math.min(
      Math.max(e.clientY - offset.current.y, 8),
      vh - el.offsetHeight - 8
    );

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (el) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        livePos.current = { x, y };
      }
    });
  }, []);

  const onPointerUp = useCallback(
    (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);

      try {
        containerRef.current.releasePointerCapture(e.pointerId);
      } catch {}

      if (!hasDragged.current) {
        onMaximize(); // tap → expand
      } else {
        setPos({ ...livePos.current }); // commit dragged position
      }
    },
    [onMaximize]
  );

  const isAudio = callType === "audio";
  const hasRemote = remoteStreams.length > 0;
  const showVideo = !isAudio && displayStream;
  const speakerName = hasRemote ? remoteStreams[0]?.fName : "You";

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        touchAction: "none",
        willChange: "transform",
        // Mount-in spring
        opacity: visible ? 1 : 0,
        transform: visible
          ? "scale(1) translateY(0)"
          : "scale(0.85) translateY(16px)",
        transition:
          "opacity 0.25s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      }}
      className={`w-48 rounded-2xl overflow-hidden shadow-2xl select-none
        border border-white/[0.08] bg-slate-900
        ${isDragging ? "cursor-grabbing" : "cursor-grab"}
      `}
    >
      {/* ── Video preview ──────────────────────────────────────────────────── */}
      {showVideo && (
        <div
          className="relative w-full overflow-hidden bg-slate-800"
          style={{ height: 120 }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal} // mute self, play remote audio
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLocal ? "scale-x-[-1]" : "" // mirror self-view
            } ${isVideoOff && isLocal ? "opacity-0" : "opacity-100"}`}
          />

          {/* Camera-off placeholder */}
          {isVideoOff && isLocal && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-800">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
                <VideoOff size={16} className="text-slate-500" />
              </div>
            </div>
          )}

          {/* Live badge */}
          <div
            className="absolute top-2 left-2 flex items-center gap-1
            bg-slate-950/60 backdrop-blur-sm rounded-full px-2 py-[3px]"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                callConnected
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="text-[8px] font-bold text-white/70 uppercase tracking-widest">
              {callConnected ? "Live" : "Wait"}
            </span>
          </div>

          {/* Who's shown */}
          <div className="absolute bottom-1.5 left-0 right-0 text-center">
            <span className="text-[9px] text-white/40 font-medium">
              {speakerName}
            </span>
          </div>

          {/* Muted indicator */}
          {isMuted && (
            <div className="absolute top-2 right-2 bg-rose-600/80 backdrop-blur-sm rounded-full p-1">
              <MicOff size={8} className="text-white" />
            </div>
          )}
        </div>
      )}

      {/* ── Audio-only avatar ────────────────────────────────────────────── */}
      {isAudio && (
        <div className="relative flex flex-col items-center pt-4 pb-2">
          {/* Pulse rings */}
          {callConnected && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-12">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <span className="absolute inset-1 rounded-full bg-emerald-500/15 animate-ping [animation-delay:0.3s]" />
            </div>
          )}
          <div
            className="relative w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-600
            flex items-center justify-center border border-white/10 shadow-lg"
          >
            <Phone size={18} className="text-slate-300" />
          </div>
          {/* Hidden audio elements for remote streams */}
          <div className="absolute w-0 h-0 overflow-hidden">
            {remoteStreams
              .filter((u) => u?.stream)
              .map((u) => (
                <audio
                  key={u.userId}
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && u.stream) {
                      el.srcObject = u.stream;
                      el.muted = false;
                      el.volume = 1;
                      el.play().catch(() => {});
                    }
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {/* ── Info section ────────────────────────────────────────────────── */}
      <div className="px-3 pt-2 pb-1 text-center">
        <p className="text-[12px] font-semibold text-white truncate leading-tight">
          {callTargetName || "Call"}
        </p>
        <p className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
          {callConnected ? formatDuration(callDuration) : "Connecting…"}
        </p>
      </div>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 px-3 pb-3 pt-1">
        {/* Mute — optional */}
        {onToggleMute && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className={`w-8 h-8 flex items-center justify-center rounded-full
              transition-all duration-150 active:scale-90 ${
                isMuted
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                  : "bg-slate-700/80 text-slate-300 hover:bg-slate-600"
              }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
        )}

        {/* Maximize / restore */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMaximize();
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full
            bg-sky-500/15 text-sky-400 border border-sky-500/20
            hover:bg-sky-500/25 transition-all duration-150 active:scale-90"
          title="Expand call"
        >
          <Maximize2 size={13} />
        </button>

        {/* End call */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEndCall();
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full
            bg-rose-600 text-white hover:bg-rose-500
            transition-all duration-150 active:scale-90 shadow-lg shadow-rose-900/40"
          title="End call"
        >
          <PhoneOff size={13} />
        </button>
      </div>

      {/* Tap hint — shown briefly on first render */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-white/5" />
    </div>
  );
};

export default MiniCallPlayer;
