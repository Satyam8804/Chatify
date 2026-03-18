import { useRef, useEffect } from "react";

const RemoteVideo = ({ stream, name }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;
    if (ref.current.srcObject !== stream) ref.current.srcObject = stream;
    ref.current.play().catch(() => {});
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="w-full h-full object-cover transform-gpu"
      />
      {name && (
        <span className="absolute bottom-2 left-3 text-[10px] text-white/40 font-medium z-10">
          {name}
        </span>
      )}
    </div>
  );
};

export default RemoteVideo;