import { X, UserPlus, Bell, Check } from "lucide-react";
import Avatar from "../common/Avatar";

const ParticipantsPanel = ({
  isOpen,
  onClose,
  joinedParticipants,
  pendingParticipants,
  addableUsers,
  onInvite,
  onNotify,
  showAddList,
  setShowAddList,
}) => {
  return (
    <>
      {/* ── Backdrop ── */}
      {isOpen && <div className="absolute inset-0 z-30" onClick={onClose} />}

      {/* ── Drawer ── */}
      <div
        className={`
          absolute top-0 right-0 h-full z-40 w-72 max-w-[85vw]
          bg-slate-900/95 border-l border-white/8 backdrop-blur-xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 shrink-0">
          <span className="text-sm font-semibold text-slate-100">
            Participants
            <span className="ml-2 text-xs font-normal text-slate-500">
              {joinedParticipants.length + pendingParticipants.length}
            </span>
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
          {/* ── Add Participants ── */}
          <div className="px-3 mb-1">
            <button
              onClick={() => setShowAddList((p) => !p)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl
                bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20
                text-emerald-400 text-sm font-medium transition-colors"
            >
              <UserPlus size={15} />
              Add participants
            </button>

            {/* Addable users list */}
            {showAddList && (
              <div className="mt-1.5 rounded-xl bg-slate-800/60 border border-white/6 overflow-hidden">
                {addableUsers.length > 0 ? (
                  addableUsers.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => onInvite(u._id)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5
                        hover:bg-slate-700/60 transition-colors text-sm text-slate-200"
                    >
                      <Avatar user={u} size={28} IsInside />
                      <span className="truncate flex-1 text-left">
                        {u.fName} {u.lName}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-3">
                    No users to add
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="px-3 my-3">
            <div className="border-t border-white/6" />
          </div>

          {/* ── Joined ── */}
          {joinedParticipants.length > 0 && (
            <div className="px-3 mb-1">
              <p className="text-[10px] font-semibold tracking-widest text-slate-600 uppercase mb-1.5 px-1">
                In call · {joinedParticipants.length}
              </p>
              <div className="space-y-0.5">
                {joinedParticipants.map((p) => (
                  <div
                    key={p._id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                  >
                    <Avatar user={p} size={32} IsInside />
                    <span className="flex-1 text-sm text-slate-200 truncate">
                      {p.fName} {p.lName}
                      {p.isSelf && (
                        <span className="ml-1.5 text-[10px] text-slate-500">
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium shrink-0">
                      <Check size={11} strokeWidth={2.5} />
                      Joined
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pending / Invited ── */}
          {pendingParticipants.length > 0 && (
            <div className="px-3 mt-2">
              <p className="text-[10px] font-semibold tracking-widest text-slate-600 uppercase mb-1.5 px-1">
                Invited · {pendingParticipants.length}
              </p>
              <div className="space-y-0.5">
                {pendingParticipants.map((p) => (
                  <div
                    key={p._id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                  >
                    <Avatar user={p} size={32} IsInside />
                    <span className="flex-1 text-sm text-slate-400 truncate">
                      {p.fName} {p.lName}
                    </span>
                    {/* Notify button */}
                    <button
                      onClick={() => onNotify(p._id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg
                        bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20
                        text-amber-400 text-[10px] font-medium transition-colors shrink-0"
                    >
                      <Bell size={10} />
                      Notify
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ParticipantsPanel;
