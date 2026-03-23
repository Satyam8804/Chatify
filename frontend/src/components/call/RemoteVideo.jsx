import { useRef, useEffect } from "react";

const RemoteVideo = ({ stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    // ✅ avoid reassigning same stream
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    // ✅ ensure playback starts only when ready
    const handleLoaded = () => {
      if (video.paused) {
        video.play().catch(() => {});
      }
    };

    video.onloadedmetadata = handleLoaded;

    // fallback (some browsers skip event)
    if (video.readyState >= 2 && video.paused) {
      video.play().catch(() => {});
    }

    return () => {
      // 🔥 cleanup (IMPORTANT)
      video.onloadedmetadata = null;

      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video
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
