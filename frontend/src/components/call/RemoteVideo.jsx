import { useRef, useEffect, useCallback } from "react";

const RemoteVideo = ({ stream }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(stream);
  streamRef.current = stream;

  const setVideoRef = useCallback((el) => {
    if (!el) return;
    videoRef.current = el;
    if (streamRef.current) {
      el.srcObject = streamRef.current;
      el.pause();
      el.load();
      el.play().catch((e) => {
        if (e.name === "AbortError") return;
        setTimeout(() => { el.play().catch(() => {}); }, 500);
      });
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.pause();
    video.load();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        if (e.name === "AbortError") return;
        setTimeout(() => { video.play().catch(() => {}); }, 500);
      });
    }

    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-contain transform-gpu"
      />
    </div>
  );
};

export default RemoteVideo;