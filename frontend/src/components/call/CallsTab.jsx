import { useMemo, useRef } from "react";
import { useAuth } from "../../context/authContext";
import Avatar from "../common/Avatar";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Video,
} from "lucide-react";
import Loader from "../../utils/Loader";

const getDayGroup = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = (startOfToday - startOfDate) / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return "earlier";
};

const CallLog = ({ log, currentUserId, onCall }) => {
  const isMissed = log.status === "missed";
  const isOutgoing = String(log.sender?._id) === String(currentUserId);
  const isVideo = log.callType === "video";
  const isGroupCall = log.isGroupCall || false;

  const otherUser = isGroupCall
    ? null
    : isOutgoing
    ? log.participants?.find((u) => String(u._id) !== String(currentUserId)) ||
      null
    : log.sender || null;

  const displayName = isGroupCall
    ? log.chat?.chatName || "Group Call"
    : `${otherUser?.fName || "Unknown"} ${otherUser?.lName || ""}`.trim();

  const DirectionIcon = isMissed
    ? PhoneMissed
    : isOutgoing
    ? PhoneOutgoing
    : PhoneIncoming;

  const directionColor = isMissed
    ? "text-rose-500"
    : isOutgoing
    ? "text-sky-500"
    : "text-emerald-500";

  const statusLabel = isMissed
    ? "Missed"
    : isOutgoing
    ? "Outgoing"
    : "Incoming";

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDuration = (secs) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const duration = formatDuration(log.duration);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/40 transition-all duration-200 group cursor-pointer">
      <Avatar
        user={isGroupCall ? null : otherUser}
        users={isGroupCall ? log.participants : null}
        isGroup={isGroupCall}
        size={40}
        IsInside
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <DirectionIcon size={12} className={`shrink-0 ${directionColor}`} />
            {isVideo ? (
              <Video
                size={12}
                className="text-gray-400 dark:text-slate-400 shrink-0"
              />
            ) : (
              <Phone
                size={12}
                className="text-gray-400 dark:text-slate-400 shrink-0"
              />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
              {displayName}
            </span>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-slate-500 shrink-0">
            {formatTime(log.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs ${directionColor}`}>{statusLabel}</span>
            {duration && (
              <>
                <span className="text-gray-300 dark:text-slate-600 text-xs">
                  ·
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-400">
                  {duration}
                </span>
              </>
            )}
          </div>

          {!isGroupCall && otherUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!otherUser) return;
                onCall(otherUser);
              }}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer transition-all duration-200 w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30"
            >
              {isVideo ? <Video size={13} /> : <Phone size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const sections = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "earlier", label: "Earlier" },
];

const CallsTab = ({
  onStartCall,
  chats,
  callLogs,
  fetchNextPage,
  hasMore,
  loading,
}) => {
  const { user } = useAuth();
  const observerRef = useRef();

  const handleCall = (otherUser) => {
    const chat = chats?.find(
      (c) =>
        !c.isGroupChat &&
        c.users?.some((u) => String(u._id) === String(otherUser._id))
    );
    if (chat) onStartCall(chat);
  };

  const lastCallRef = (node) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) fetchNextPage();
    });
    if (node) observerRef.current.observe(node);
  };

  const groupedLogs = useMemo(() => {
    if (!callLogs.length) return { today: [], yesterday: [], earlier: [] };
    const groups = { today: [], yesterday: [], earlier: [] };
    for (const log of callLogs) {
      const group = getDayGroup(log.createdAt);
      groups[group].push(log);
    }
    return groups;
  }, [callLogs]);

  if (loading && callLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <Loader className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">
          Loading calls...
        </p>
        <span className="text-xs text-gray-400 dark:text-slate-500">
          Please wait a moment
        </span>
      </div>
    );
  }

  if (callLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {/* Loader / Icon Container */}
        <div className="relative flex items-center justify-center">
          {/* Glow */}
          <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />

          {/* Loader (center) */}
          <div className="absolute">
            <Loader size={28} />
          </div>

          {/* Background circle */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
            <Phone size={20} className="text-emerald-500 opacity-40" />
          </div>
        </div>

        {/* Text */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
            No recent calls
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Your call history will appear here
          </p>
        </div>
      </div>
    );
  }

  const lastNonEmptySection = [...sections]
    .reverse()
    .find(({ key }) => groupedLogs[key].length > 0)?.key;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar py-2 space-y-3">
      {sections.map(({ key, label }) => {
        const logs = groupedLogs[key];
        if (!logs.length) return null;

        return (
          <div key={key}>
            <div className="px-3 mb-1">
              <span className="text-[10px] font-semibold tracking-widest text-gray-400 dark:text-slate-500 uppercase">
                {label}
              </span>
            </div>

            <div className="space-y-0.5 px-2">
              {logs.map((log, index) => {
                const isLastItem =
                  key === lastNonEmptySection && index === logs.length - 1;
                return (
                  <div
                    ref={isLastItem ? lastCallRef : null}
                    key={`${log._id}-${log.createdAt}`}
                  >
                    <CallLog
                      log={log}
                      currentUserId={user?._id?.toString()} // ✅ force string
                      onCall={handleCall}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {loading && callLogs.length > 0 && (
        <div className="flex items-center justify-center py-3">
          <Loader className="w-5 h-5 text-emerald-500" />
        </div>
      )}
    </div>
  );
};

export default CallsTab;
