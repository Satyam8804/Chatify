import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../context/authContext";
import Avatar from "../common/Avatar";
import { groupByDay } from "../../utils/dateUtils";

import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Video,
} from "lucide-react";
import { Loader } from "lucide-react";

const CallLog = ({ log, currentUserId, onCall }) => {
  const isMissed = log.status?.toLowerCase() === "missed";
  const isOutgoing = String(log.sender?._id) === String(currentUserId);
  const type = log.callType;

  const participants = log.participants || [];

  const isEscalatedGroupCall = !log.chat?.chatName && participants.length > 2;

  const isGroupCall = log.chat?.chatName || isEscalatedGroupCall;

  const otherParticipants = participants.filter(
    (p) => String(p._id) !== String(currentUserId)
  );

  let displayName = "";

  if (isGroupCall && log.chat?.chatName) {
    displayName = log.chat.chatName;
  } else if (isGroupCall) {
    const names = otherParticipants.map((p) => p.fName).filter(Boolean);

    if (names.length <= 3) {
      displayName = names.join(", ");
    } else {
      displayName = `${names.slice(0, 3).join(", ")} +${
        names.length - 3
      } others`;
    }
  } else {
    let otherUser = null;

    if (isOutgoing) {
      // participants has ONLY receiver in 1-1
      otherUser = (log.participants || [])[0];
    } else {
      otherUser = log.sender;
    }

    displayName = `${otherUser?.fName || "Unknown"} ${
      otherUser?.lName || ""
    }`.trim();
    displayName = `${otherUser?.fName || "Unknown"} ${
      otherUser?.lName || ""
    }`.trim();
  }

  const callbackUser = !isGroupCall
    ? isOutgoing
      ? (log.participants || [])[0]
      : log.sender
    : null;

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
        user={!isGroupCall ? callbackUser : null}
        users={isGroupCall ? otherParticipants : null}
        isGroup={isGroupCall}
        size={40}
        IsInside
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <DirectionIcon size={12} className={`shrink-0 ${directionColor}`} />
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
            {isGroupCall && !log.chat?.chatName && (
              <>
                <span className="text-gray-300 dark:text-slate-600 text-xs">
                  ·
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-400">
                  {otherParticipants.length} invited
                </span>
              </>
            )}
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

          {callbackUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCall(callbackUser, type);
              }}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer transition-all duration-200 w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30"
            >
              {type === "video" ? <Video size={13} /> : <Phone size={13} />}
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
  ongoingCall,
  onJoinCall,
}) => {
  const { user } = useAuth();
  const observerRef = useRef();

  const groupedLogs = useMemo(
    () => groupByDay(callLogs, "createdAt"),
    [callLogs]
  );

  const handleCall = (otherUser, callType = "video") => {
    const chat = chats?.find(
      (c) =>
        !c.isGroupChat &&
        c.users?.some((u) => String(u._id) === String(otherUser._id))
    );

    if (!chat) return;
    if (chat) onStartCall(chat, callType);
  };

  const lastCallRef = (node) => {
    if (loading || !hasMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchNextPage();
      }
    });
    if (node) observerRef.current.observe(node);
  };

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  if (loading && callLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
        {/* Simple Loader */}
        <Loader className="w-10 h-10 animate-spin text-emerald-500" />

        {/* Text */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
            Loading calls...
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Fetching your call history
          </p>
        </div>
      </div>
    );
  }

  if (!loading && callLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {/* Icon Container */}
        <div className="relative flex items-center justify-center">
          {/* Glow */}
          <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />

          {/* Circle */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center 
          bg-white dark:bg-slate-800 
          border border-gray-200 dark:border-slate-700 shadow-sm"
          >
            <Phone
              size={22}
              className="text-emerald-500 opacity-60 group-hover:opacity-100 transition"
            />
          </div>
        </div>

        {/* Text */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
            No call logs
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Your recent calls will appear here
          </p>
        </div>
      </div>
    );
  }

  const lastNonEmptySection = [...sections]
    .reverse()
    .find(({ key }) => groupedLogs[key].length > 0)?.key;

  console.log("📺 CallsTab ongoingCall:", ongoingCall);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar py-2 space-y-3">
      {ongoingCall && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/40 transition-all duration-200 group cursor-pointer">
          {/* Top row */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              {/* Pulsing live dot */}
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              <span className="text-sm font-semibold text-white">
                Ongoing Call
              </span>
              <span className="text-xs text-emerald-200 font-medium">
                {ongoingCall.callType === "video" ? "· Video" : "· Audio"}
              </span>
            </div>

            <button
              onClick={() => {
                const chat = chats.find(
                  (c) => String(c._id) === String(ongoingCall.chatId)
                );

                if (!chat) return;

                onJoinCall(chat, ongoingCall.callType || "video");
              }}
              className="bg-white text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors"
            >
              Join
            </button>
          </div>

          {/* Participants row */}
          {ongoingCall.participants?.length > 0 && (
            <div className="flex items-center gap-2 px-3 pb-3">
              {/* Stacked avatars */}
              <div className="flex -space-x-2 shrink-0">
                {ongoingCall.participants.slice(0, 3).map((p, i) => {
                  const participantUser = chats
                    ?.flatMap((c) => c.users || [])
                    .find((u) => String(u._id) === String(p));

                  return (
                    <Avatar
                      key={i}
                      user={participantUser || { _id: p }}
                      size={22}
                      IsInside
                      className="ring-2 ring-emerald-600"
                    />
                  );
                })}
              </div>

              {/* Names */}
              <span className="text-xs text-emerald-100 truncate">
                {(() => {
                  const participants = ongoingCall.participants;
                  const resolved = participants.map((p) => {
                    const u = chats
                      ?.flatMap((c) => c.users || [])
                      .find((u) => String(u._id) === String(p));
                    return u?.fName || "Unknown";
                  });

                  if (resolved.length <= 2) return resolved.join(", ");
                  return `${resolved.slice(0, 2).join(", ")} & ${
                    resolved.length - 2
                  } other${resolved.length - 2 > 1 ? "s" : ""}`;
                })()}
              </span>
            </div>
          )}
        </div>
      )}

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
                  <div ref={isLastItem ? lastCallRef : null} key={log._id}>
                    <CallLog
                      log={log}
                      currentUserId={user?._id?.toString()}
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
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader className="w-5 h-5 animate-spin text-emerald-500" />

          <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
            Loading more calls...
          </span>
        </div>
      )}
    </div>
  );
};

export default CallsTab;
