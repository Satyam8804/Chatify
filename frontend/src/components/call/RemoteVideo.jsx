import { useRef, useEffect } from "react";

const RemoteVideo = ({ stream }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;

    const video = ref.current;
    video.srcObject = stream;

    // cancel any in-flight play before starting new one
    video.pause();
    video.load();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        if (e.name === "AbortError") return; // expected during remount, ignore
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