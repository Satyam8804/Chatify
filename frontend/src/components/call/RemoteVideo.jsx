import { useRef, useEffect } from "react";

const RemoteVideo = ({ stream }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;
    console.log(
      "[RemoteVideo] setting srcObject — streamId:",
      stream.id,
      "videoTracks:",
      stream.getVideoTracks().length,
      "trackState:",
      stream.getVideoTracks()[0]?.readyState
    );
    ref.current.srcObject = stream;
    const playPromise = ref.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => console.log("[RemoteVideo] playing"))
        .catch((e) => {
          console.warn("[RemoteVideo] play failed:", e);
          setTimeout(() => {
            ref.current?.play().catch(() => {});
          }, 500);
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
