import { useEffect, useRef, useState,useMemo } from "react";
import { useAuth } from "../../context/authContext";
import Avatar from "../common/Avatar";
import { useSocket } from "../../context/socketContext";
import TypingIndicator from "./TypingIndicator";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import {
  Reply,
  ChevronDown,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { getAvatarColor } from "../../utils/getAvatarColor";
import { FaFilePdf } from "react-icons/fa";
import AudioPlayer from "./AudioPlayer";
import ImagePreview from "./ImagePreview";
import { getDateLabel } from "../../utils/dateUtils.js";
import { PhoneCall, Video, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const DeleteConfirmModal = ({ onConfirm, onCancel, isDeleted }) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    onClick={onCancel}
  >
    <div
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 w-[300px] mx-4 border border-gray-100 dark:border-slate-700"
      onClick={(e) => e.stopPropagation()}
      style={{
        animation: "popIn 0.18s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}
    >
      <style>{`
        @keyframes popIn {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>

      {/* Icon */}
      <div className="flex justify-center mb-3">
        <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Trash2 size={20} className="text-red-500" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-center text-[14px] font-semibold text-gray-900 dark:text-white mb-1">
        {isDeleted ? "Delete permanently?" : "Delete this message?"}
      </h3>

      {/* Description */}
      <p className="text-center text-[12px] text-gray-500 dark:text-slate-400 mb-5">
        {isDeleted
          ? "This message is already hidden. Deleting again will permanently remove it for everyone."
          : "This will hide the message for everyone. You can permanently delete it afterwards."}
      </p>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-[13px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 rounded-xl text-[13px] font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          {isDeleted ? "Delete forever" : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

const MessageList = ({
  messages,
  onReply,
  onStartCall,
  chat,
  onDeleteMessage,
}) => {
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const { typingUser } = useSocket();
  const [previewImage, setPreviewImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const messageRefs = useRef({});
  const isGroup = chat?.isGroupChat;

  const handleReplyClick = (id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      let count = 0;
      const interval = setInterval(() => {
        el.style.transition = "background 0.3s ease";
        el.style.background = count % 2 === 0 ? "rgba(52, 211, 153, 0.3)" : "";
        count++;
        if (count > 5) {
          clearInterval(interval);
          el.style.background = "";
        }
      }, 500);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  return (
    <div className="h-full overflow-y-auto gap-2 hide-scrollbar p-2 pb-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      {messages.map((msg, index) => {
        const currentLabel = getDateLabel(msg.createdAt);
        const prevLabel =
          index > 0 ? getDateLabel(messages[index - 1].createdAt) : null;
        const showDivider = currentLabel !== prevLabel;
        return (
          <div key={msg._id}>
            {showDivider && <DateDivider label={currentLabel} />}
            <MessageBubble
              message={msg}
              setPreviewImage={setPreviewImage}
              copiedId={copiedId}
              setCopiedId={setCopiedId}
              isOwn={msg.sender?._id === user?._id}
              isGroup={isGroup}
              onReply={onReply}
              messageRefs={messageRefs}
              onReplyClick={handleReplyClick}
              onStartCall={onStartCall}
              onDeleteMessage={onDeleteMessage}
              chat={chat}
            />
          </div>
        );
      })}

      {previewImage && (
        <ImagePreview
          url={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}

      <TypingIndicator user={typingUser} />
      <div ref={bottomRef}></div>
    </div>
  );
};

const MessageBubble = ({
  message,
  isOwn,
  isGroup,
  copiedId,
  setCopiedId,
  setPreviewImage,
  onReply,
  onReplyClick,
  messageRefs,
  onStartCall,
  onDeleteMessage,
  chat,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const { user } = useAuth();

  const isGroupAdmin =
    chat?.isGroupChat && chat?.groupAdmin?.toString() === user?._id?.toString();

  const userColor = !isOwn
    ? getAvatarColor(message.sender?._id || message.sender?.fName)
    : "";

  const isCall = message.messageType === "call";

  const time = useMemo(
    () =>
      new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [message.createdAt]
  );

  const copyMessage = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(message._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // noop
    }
    setMenuOpen(false);
  };

  const handleReply = () => {
    onReply?.(message);
    setMenuOpen(false);
  };

  const handleDeleteClick = () => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDeleteMessage?.(message._id);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e) => {
      const target = e.target;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const renderMessage = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={`${part}-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      ) : (
        <span key={`${part}-${i}`}>{part}</span>
      )
    );
  };

  const menuItems = [
    {
      label: "Reply",
      icon: <Reply size={14} />,
      onClick: handleReply,
      show: !message.isDeleted,
    },
    {
      label: copiedId === message._id ? "Copied" : "Copy",
      icon: copiedId === message._id ? <Check size={14} /> : <Copy size={14} />,
      onClick: () => copyMessage(message.content || ""),
      show: !!message.content && !isCall && !message.isDeleted,
    },
    {
      label: "Delete",
      icon: <Trash2 size={14} />,
      onClick: handleDeleteClick,
      show: (isOwn || isGroupAdmin) && !isCall,
      danger: true,
    },
  ].filter((item) => item.show);

  const replyBlock = message.replyTo && (
    <div
      onClick={() => onReplyClick?.(message.replyTo._id)}
      className={`border-l-4 border-emerald-500 pl-2 mb-1 rounded-md p-1 cursor-pointer hover:opacity-80 flex items-center gap-2 min-w-0 ${
        isOwn
          ? "bg-emerald-200/50 dark:bg-emerald-800/50"
          : "bg-gray-100 dark:bg-slate-700"
      }`}
    >
      {message.replyTo.media?.length > 0 &&
        (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
          message.replyTo.media[0].name?.split(".").pop()?.toLowerCase()
        ) || message.replyTo.media[0].type?.startsWith("image/") ? (
          <img
            src={message.replyTo.media[0].url}
            alt="reply preview"
            className="w-10 h-10 rounded object-cover shrink-0"
          />
        ) : (
          <span className="shrink-0">📎</span>
        ))}

      <div className="min-w-0 flex-1">
        <p className="text-emerald-500 font-medium text-[10px] truncate">
          {message.replyTo.sender?.fName}
        </p>

        <div className="text-gray-500 dark:text-slate-400 truncate text-[11px] flex items-center gap-2">
          {message.replyTo.messageType === "call" ? (
            (() => {
              const {
                status,
                callType: type,
                duration = 0,
              } = message.replyTo.callData || {};

              const isIncoming =
                message.replyTo.sender?._id !== message.sender?._id;

              const cc =
                status === "missed" && isIncoming
                  ? "text-red-500"
                  : status === "completed"
                  ? "text-green-500"
                  : "text-gray-400";

              return (
                <span className="flex items-center gap-1 min-w-0">
                  {type === "video" ? (
                    <Video size={12} className={cc} />
                  ) : (
                    <PhoneCall size={12} className={cc} />
                  )}

                  <span className="truncate">
                    {status === "missed"
                      ? isIncoming
                        ? "Missed call"
                        : "Call not answered"
                      : status === "completed"
                      ? type === "video"
                        ? "Video call"
                        : "Voice call"
                      : "Call declined"}
                  </span>

                  {duration > 0 && (
                    <span className="ml-1 text-[10px] text-gray-400 whitespace-nowrap">
                      • {Math.floor(duration / 60)}:
                      {(duration % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                </span>
              );
            })()
          ) : message.replyTo.isDeleted ? (
            <span className="flex items-center gap-1 text-gray-400">
              <Ban size={12} className="opacity-70" />
              Deleted message
            </span>
          ) : message.replyTo.content ? (
            <span className="truncate">{message.replyTo.content}</span>
          ) : message.replyTo.media?.length > 0 ? (
            <span className="flex items-center gap-1 text-gray-500">
              <Paperclip size={12} className="opacity-70" />
              Media
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showDeleteConfirm && (
        <DeleteConfirmModal
          isDeleted={message.isDeleted}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div
        ref={(el) => {
          if (el) messageRefs.current[message._id] = el;
        }}
        className={`group relative flex mb-1 items-end gap-1 ${
          isOwn ? "justify-end" : "justify-start"
        }`}
      >
        {!isOwn && isGroup && (
          <div className="self-end mb-1 shrink-0 mr-1">
            <Avatar user={message?.sender} size={24} IsInside />
          </div>
        )}

        <div className="relative max-w-[70%] min-w-[60px] shrink-0">
          {menuItems.length > 0 && (
            <div
              ref={menuRef}
              className={`absolute top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 ${
                isOwn ? "-left-9" : "-right-9"
              }`}
            >
              <button
                ref={triggerRef}
                onClick={() => setMenuOpen((p) => !p)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700/80 text-slate-200 shadow-lg ring-1 ring-white/10 hover:bg-slate-600 transition"
                aria-label="Open message menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                type="button"
              >
                <ChevronDown size={14} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className={`absolute top-1/2 -translate-y-1/2 min-w-[150px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800 ${
                    isOwn ? "right-8" : "left-8"
                  }`}
                >
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      onClick={item.onClick}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-slate-700 ${
                        item.danger
                          ? "text-red-500"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                      type="button"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            className={`relative rounded-2xl px-2 py-1 text-sm shadow-sm break-words ${
              isOwn
                ? "bg-emerald-100 text-black dark:bg-emerald-900 dark:text-emerald-50 rounded-tr-none"
                : "bg-white text-black dark:bg-slate-800 dark:text-slate-100 rounded-tl-none"
            }`}
          >
            {!isOwn && isGroup && !isCall && (
              <p
                className="mb-[2px] text-[10px] font-semibold"
                style={{ color: userColor }}
              >
                {message.sender?.fName}
              </p>
            )}

            {message.replyTo && replyBlock}

            {isCall ? (
              <CallBubble
                message={message}
                isOwn={isOwn}
                onStartCall={onStartCall}
                chat={chat}
                time={time}
              />
            ) : message.isDeleted ? (
              <span className="flex items-center gap-1 px-1 py-[2px] text-[12px] italic text-gray-400 dark:text-slate-500">
                <Ban size={14} className="shrink-0" />
                {message.deletedBy?.toString() === user?._id?.toString() ||
                isOwn
                  ? "You deleted this message"
                  : "This message was deleted"}
              </span>
            ) : (
              <>
                {message.content && (
                  <span className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                    {renderMessage(message.content)}
                  </span>
                )}

                {message.media?.length > 0 &&
                  message.media.map((m, i) => (
                    <MediaRenderer
                      key={m?._id || i}
                      media={m}
                      uploading={message.uploading}
                      setPreviewImage={setPreviewImage}
                      isOwn={isOwn}
                      time={time}
                    />
                  ))}
              </>
            )}

            {!isCall && !(message.media?.length > 0) && !message.isDeleted && (
              <div className="mt-[2px] flex items-center justify-end gap-1">
                <span className="text-[9px] text-gray-400 dark:text-slate-500">
                  {time}
                </span>
                {isOwn &&
                  (message.readBy?.length > 1 ? (
                    <BsCheckAll color="#34d399" size={14} />
                  ) : (
                    <BsCheck color="gray" size={14} />
                  ))}
              </div>
            )}

            <div
              className={`absolute top-0 h-0 w-0 ${
                isOwn
                  ? "-right-[6px] border-l-[8px] border-l-emerald-100 dark:border-l-emerald-900 border-b-[8px] border-b-transparent"
                  : "-left-[6px] border-r-[8px] border-r-white dark:border-r-slate-800 border-b-[8px] border-b-transparent"
              }`}
            />
          </div>
        </div>
      </div>
    </>
  );
};

const CallBubble = ({ message, isOwn, onStartCall, chat, time }) => {
  const { callType, status, duration = 0 } = message.callData || {};
  const isIncoming = !isOwn;
  const participantsCount = message?.participants?.length || 0;

  const isGroup =
    message?.chat?.chatName ||
    (!message?.chat?.chatName && participantsCount > 2);

  const isVideo = callType === "video";

  const formatDuration = (sec) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  const statusLabel = (() => {
    if (isGroup && !message?.chat?.chatName)
      return `${Math.max(participantsCount - 1, 0)} invited`;

    if (status === "missed") return isIncoming ? "Missed" : "No answer";

    if (status === "completed")
      return duration > 0 ? formatDuration(duration) : "Ended";

    return "Declined";
  })();

  const handleCall = (e) => {
    e.stopPropagation();
    if (!message?.chat) return;
    onStartCall?.(chat, callType);
  };

  return (
    // 🔥 OUTER LAYER (subtle darker tone)
    <div
      className={`p-[2px] rounded-2xl
        ${
          isOwn ? "bg-emerald-800/60" : "bg-slate-700/60 dark:bg-slate-700/70"
        }`}
    >
      {/* 🔥 INNER LAYER (main bubble) */}
      <div
        onClick={handleCall}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] min-w-[200px] max-w-[260px]
          cursor-pointer transition-colors duration-200 active:scale-[0.98]
          ${
            isOwn
              ? "bg-emerald-700 hover:bg-emerald-600"
              : "bg-slate-700 hover:bg-slate-800"
          }`}
      >
        {/* Icon circle */}
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0
            ${isOwn ? "bg-emerald-600" : "bg-slate-700"}`}
        >
          {isVideo ? (
            <Video size={16} className="text-white" />
          ) : (
            <PhoneCall size={16} className="text-white" />
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-white truncate">
            {isGroup
              ? isVideo
                ? "Group video call"
                : "Group audio call"
              : isVideo
              ? "Video call"
              : "Audio call"}
          </span>

          <span className="text-[11px] text-white/70 truncate">
            {statusLabel}
          </span>
        </div>

        {/* Time + tick */}
        <div className="flex flex-col items-end gap-[2px] shrink-0">
          <span className="text-[10px] text-white/60">{time}</span>

          {isOwn &&
            (message.readBy?.length > 1 ? (
              <BsCheckAll color="#22c55e" size={12} />
            ) : (
              <BsCheck color="gray" size={12} />
            ))}
        </div>
      </div>
    </div>
  );
};

const MediaRenderer = ({ media, uploading, setPreviewImage, isOwn, time }) => {
  const url = media?.url || "";
  const name = media?.name || "";
  const extension = name.split(".").pop()?.toLowerCase();

  const isImage =
    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension) ||
    media?.type?.startsWith("image/");

  const isVideo =
    ["mp4", "webm", "mov"].includes(extension) ||
    media?.type?.startsWith("video/");

  const isAudio =
    ["mp3", "wav", "ogg"].includes(extension) ||
    media?.type?.startsWith("audio/");

  const uploadingOverlay = (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg z-10">
      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isImage)
    return (
      <div className="relative w-full overflow-hidden rounded-lg">
        <img
          src={url}
          alt="media"
          onClick={() => !uploading && setPreviewImage(url)}
          className="w-full max-h-[250px] rounded-lg cursor-pointer object-cover block"
        />
        <div className="absolute bottom-2 right-2 z-20">
          <span className="text-[9px] px-2 py-[2px] rounded-full bg-black/45 text-white backdrop-blur-sm">
            {time}
          </span>
        </div>
        {uploading && uploadingOverlay}
      </div>
    );

  if (isVideo)
    return (
      <div className="relative w-full overflow-hidden rounded-lg">
        <video
          controls
          className="w-full max-h-[250px] rounded-lg object-cover"
        >
          <source src={url} />
        </video>
        <div className="absolute bottom-2 right-2 z-20">
          <span className="text-[9px] px-2 py-[2px] rounded-full bg-black/45 text-white backdrop-blur-sm">
            {time}
          </span>
        </div>
        {uploading && uploadingOverlay}
      </div>
    );

  if (isAudio)
    return (
      <div
        className={`relative w-full rounded-lg px-2 py-2 ${
          isOwn
            ? "bg-emerald-200 dark:bg-emerald-800"
            : "bg-gray-100 dark:bg-slate-700"
        }`}
      >
        <AudioPlayer url={url} />
        <div className="mt-1 flex justify-end">
          <span className="text-[9px] text-gray-400 dark:text-slate-500">
            {time}
          </span>
        </div>
        {uploading && uploadingOverlay}
      </div>
    );

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative p-2 rounded-lg max-w-[70vw] sm:max-w-[250px] flex items-center gap-2 cursor-pointer transition-colors
        ${
          isOwn
            ? "bg-emerald-200 dark:bg-emerald-800 hover:bg-emerald-300 dark:hover:bg-emerald-700"
            : "bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600"
        }`}
    >
      <FaFilePdf color="red" size={22} />
      <div className="min-w-0 flex-1">
        <span className="block text-sm truncate break-all text-gray-800 dark:text-slate-200">
          {name}
        </span>
      </div>

      <span className="shrink-0 text-[9px] text-gray-400 dark:text-slate-500 ml-2 self-end">
        {time}
      </span>

      {uploading && uploadingOverlay}
    </a>
  );
};

// ─── DateDivider ──────────────────────────────────────────────────────────────
const DateDivider = ({ label }) => (
  <div className="flex justify-center my-3">
    <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 px-3 py-1 rounded-full bg-gray-200/70 dark:bg-slate-700/60 shadow-sm">
      {label}
    </span>
  </div>
);

export default MessageList;
