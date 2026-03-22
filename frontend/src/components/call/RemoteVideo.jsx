import { useRef, useEffect } from "react";

const RemoteVideo = ({ stream, streamId }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    // ✅ Only set srcObject
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.play().catch(() => {});
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      <video
        key={streamId} // ✅ now valid
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-contain transform-gpu"
      />
    </div>
  );
};

export default RemoteVideo;
