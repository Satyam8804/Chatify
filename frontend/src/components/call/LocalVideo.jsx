import { VideoOff } from "lucide-react";

const LocalVideo = ({ videoRef, isFrontCamera, isVideoOff, className = "" }) => {
  return (
    <div className={`relative w-full h-full bg-slate-900 overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isFrontCamera ? "scale-x-[-1]" : ""
        } ${isVideoOff ? "opacity-0" : "opacity-100"}`}
      />
      {isVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-600">
          <VideoOff size={16} />
          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-700">
            Off
          </span>
        </div>
      )}
    </div>
  );
};

export default LocalVideo;