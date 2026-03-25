import { useRef, useState } from "react";
import LocalVideo from "./LocalVideo";
import RemoteVideo from "./RemoteVideo";
import { MicOff } from "lucide-react";

const PiPThumbnail = ({
  swapped,
  canSwap,
  onSwap,
  remoteStreams,
  selectedRemoteIndex,
  isMuted,
  localVideoRef,
  isFrontCamera,
  isVideoOff,
}) => {
  const [pos, setPos] = useState({ x: null, y: 56 });
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const livePos = useRef({ x: null, y: 56 }); // tracks pos without re-render
  const ref = useRef();

  const onPointerDown = (e) => {
    if (!ref.current) return;
    e.preventDefault();
    dragging.current = true;
    hasDragged.current = false;
    const rect = ref.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    startPos.current = { x: e.clientX, y: e.clientY };
    ref.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging.current || !ref.current) return;

    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 6 || dy > 6) hasDragged.current = true;
    if (!hasDragged.current) return;

    const parent = ref.current.parentElement.getBoundingClientRect();
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const x = Math.min(
      Math.max(e.clientX - parent.left - offset.current.x, 8),
      parent.width - w - 8
    );
    const y = Math.min(
      Math.max(e.clientY - parent.top - offset.current.y, 8),
      parent.height - h - 8
    );

    // ✅ directly update DOM — no React re-render, smooth on mobile
    ref.current.style.left = `${x}px`;
    ref.current.style.top = `${y}px`;
    ref.current.style.right = "auto";
    livePos.current = { x, y };
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;

    if (!hasDragged.current) {
      onSwap();
    } else {
      // ✅ sync to state only once on release so position survives re-renders
      setPos({ ...livePos.current });
    }
  };

  const style =
    pos.x !== null
      ? {
          position: "absolute",
          left: pos.x,
          top: pos.y,
          right: "auto",
          touchAction: "none",
        }
      : { position: "absolute", right: 12, top: 56, touchAction: "none" };
  return (
    <div
      ref={ref}
      style={{ ...style, touchAction: "none" }} // ← this is the actual fix
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`z-20 w-24 h-32 sm:w-28 sm:h-40 rounded-2xl overflow-hidden
    border border-white/10 shadow-2xl bg-slate-900
    ${canSwap ? "cursor-grab active:cursor-grabbing" : ""}
  `}
    >
      {swapped ? (
        remoteStreams[selectedRemoteIndex] && (
          <RemoteVideo stream={remoteStreams[selectedRemoteIndex]?.stream} />
        )
      ) : (
        <LocalVideo
          videoRef={localVideoRef}
          isFrontCamera={isFrontCamera}
          isVideoOff={isVideoOff}
        />
      )}

      {(swapped ? remoteStreams[selectedRemoteIndex]?.isMuted : isMuted) && (
        <span className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur-md p-1 rounded-full border border-white/10">
          <MicOff size={10} className="text-white" />
        </span>
      )}

      <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/30 font-medium z-10">
        {swapped ? remoteStreams[selectedRemoteIndex]?.fName : "You"}
      </span>
    </div>
  );
};

export default PiPThumbnail;
