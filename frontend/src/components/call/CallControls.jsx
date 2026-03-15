import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCcw, UserPlus } from "lucide-react";

const idleBtn = "flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/90 border border-white/10 text-slate-300 backdrop-blur-sm transition-all duration-200 active:scale-95";
const warnBtn = "flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 backdrop-blur-sm transition-all duration-200 active:scale-95";

const CallControls = ({
  isMuted,
  isVideoOff,
  isSwitching,
  showAddParticipant,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  onToggleAddParticipant,
  onEndCall,
}) => {
  return (
    <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4">
      <button onClick={onToggleMute} className={isMuted ? warnBtn : idleBtn}>
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>
      <button onClick={onToggleVideo} className={isVideoOff ? warnBtn : idleBtn}>
        {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
      </button>
      <button onClick={onSwitchCamera} disabled={isSwitching} className={idleBtn}>
        <RefreshCcw size={20} className={isSwitching ? "animate-spin" : ""} />
      </button>
      <button onClick={onToggleAddParticipant} className={showAddParticipant ? warnBtn : idleBtn}>
        <UserPlus size={20} />
      </button>
      <button
        onClick={onEndCall}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-600 text-white active:scale-95 transition-all"
      >
        <PhoneOff size={22} />
      </button>
    </div>
  );
};

export default CallControls;