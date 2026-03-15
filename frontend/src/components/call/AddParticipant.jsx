import { X } from "lucide-react";
import Avatar from "../common/Avatar";

const AddParticipant = ({ addableUsers, onInvite, onClose }) => {
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-slate-800 border border-white/10 rounded-2xl p-3 w-56 shadow-2xl">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Add to call
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto hide-scrollbar space-y-1">
        {addableUsers.length > 0 ? (
          addableUsers.map((u) => (
            <button
              key={u._id}
              onClick={() => onInvite(u._id)}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-700 rounded-xl text-sm text-white transition-colors"
            >
              <Avatar user={u} size={28} IsInside />
              <span className="truncate">{u.fName} {u.lName}</span>
            </button>
          ))
        ) : (
          <div className="text-xs text-slate-400 text-center py-2">
            No users available
          </div>
        )}
      </div>
    </div>
  );
};

export default AddParticipant;