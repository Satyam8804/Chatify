import { useRef, useEffect } from "react";

const RemoteVideo = ({ stream }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;

    ref.current.srcObject = stream; // always reassign, don't skip

    const playPromise = ref.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setTimeout(() => { ref.current?.play().catch(() => {}); }, 500);
      });
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-contain transform-gpu"
      />
    </div>
  );
};

export default RemoteVideo;