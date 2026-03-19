import Avatar from "../common/Avatar";
import { MicOff } from "lucide-react";

const ParticipantCard = ({ user, isSelf, isMuted, isSpeaking,color }) => {
  return (
    <div
      className={`
        relative flex flex-col items-center justify-center gap-3
        bg-slate-900 rounded-2xl py-6 px-3 overflow-hidden
        border-2 transition-all duration-300
        ${
          isSpeaking
            ? "border-emerald-400/60 shadow-[0_0_0_3px_rgba(74,222,128,0.08)]"
            : isSelf
            ? "border-sky-500/10"
            : "border-white/[0.06] opacity-90"
        }
      `}
    >
      {isSpeaking && (
        <span className="absolute inset-0 rounded-2xl border-2 border-emerald-400/30 animate-ping pointer-events-none" />
      )}

      <Avatar user={user} size={64} IsInside={true} isSpeaking={isSpeaking} />

      <div className="flex flex-col items-center gap-1">
        <span className={`text-[16px] font-bold text-${color} truncate max-w-[100px]`}>
          {isSelf ? "You" : user?.fName}
        </span>

        {isMuted && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 text-[10px] text-red-400 font-medium">
            <MicOff size={9} />
            Muted
          </span>
        )}
      </div>
    </div>
  );
};

export default ParticipantCard;
