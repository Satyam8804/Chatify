import { VideoOff } from "lucide-react";

const LocalVideo = ({ videoRef, isFrontCamera, isVideoOff, name = "You", className = "" }) => {
  return (
    <div className={`relative w-full h-full bg-slate-900 overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-contain transform-gpu transition-opacity duration-300 ${
          isFrontCamera ? "scale-x-[-1]" : ""
        } ${isVideoOff ? "opacity-0" : "opacity-100"}`}
      />

      {isVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900">
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
            <VideoOff size={18} className="text-slate-500" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-600">
            Camera Off
          </span>
        </div>
      )}

      {name && (
        <span className="absolute bottom-2 left-3 text-[10px] text-white/40 font-medium z-10">
          {name}
        </span>
      )}
    </div>
  );
};

export default LocalVideo;