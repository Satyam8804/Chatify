import { useEffect, useRef, useState } from "react";
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

  const { user } = useAuth();

  const isGroupAdmin =
    chat?.isGroupChat && chat?.groupAdmin?.toString() === user?._id?.toString();

  const userColor = !isOwn
    ? getAvatarColor(message.sender?._id || message.sender?.fName)
    : "";

  const isCall = message.messageType === "call";

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(message._id);
    setTimeout(() => setCopiedId(null), 1500);
    setMenuOpen(false);
  };

  const handleReply = () => {
    onReply(message);
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

    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderMessage = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          {part}
        </a>
      ) : (
        part
      )
    );
  };

  const menuItems = [
    {
      label: "Reply",
      icon: <Reply size={13} />,
      onClick: handleReply,
      show: !message.isDeleted,
    },
    {
      label: copiedId === message._id ? "Copied!" : "Copy",
      icon: copiedId === message._id ? <Check size={13} /> : <Copy size={13} />,
      onClick: () => copyMessage(message.content),
      show: !!message.content && !isCall && !message.isDeleted,
    },
    {
      label: "Delete",
      icon: <Trash2 size={13} />,
      onClick: handleDeleteClick,
      show: (isOwn || isGroupAdmin) && !isCall,
      danger: true,
    },
  ].filter((i) => i.show);

  const bubbleShiftClass = isOwn
    ? "group-hover:-translate-x-2"
    : "group-hover:translate-x-2";

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
        className={`group relative flex mb-1 items-center ${
          isOwn ? "justify-end" : "justify-start"
        }`}
      >
        {/* Avatar: group chats + received only */}
        {!isOwn && isGroup && (
          <div className="self-end mb-1 shrink-0 mr-1">
            <Avatar user={message?.sender} size={24} IsInside />
          </div>
        )}

        {/* Menu on left for own message, right for others */}
        {menuItems.length > 0 && (
          <div
            ref={menuRef}
            className={`absolute top-1/2 -translate-y-1/2 z-20 ${
              isOwn ? "left-[-28px]" : "right-[-28px]"
            }`}
          >
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className={`transform transition-all duration-200
                scale-0 opacity-0 translate-y-0
                group-hover:scale-100 group-hover:opacity-100
                text-gray-400 hover:text-emerald-500 cursor-pointer p-1 rounded-full
                hover:bg-gray-100 dark:hover:bg-slate-700
                ${
                  menuOpen
                    ? "!scale-100 !opacity-100 rotate-180 text-emerald-500"
                    : "rotate-0"
                }`}
            >
              <ChevronDown size={14} />
            </button>

            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                [isOwn ? "left" : "right"]: 0,
                minWidth: "130px",
                zIndex: 50,
                transformOrigin: isOwn ? "top left" : "top right",
                transform: menuOpen ? "scale(1)" : "scale(0.85)",
                opacity: menuOpen ? 1 : 0,
                pointerEvents: menuOpen ? "auto" : "none",
                transition:
                  "transform 0.15s cubic-bezier(0.34,1.56,0.64,1), opacity 0.12s ease",
              }}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-100 dark:border-slate-700 overflow-hidden py-1"
            >
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-2 px-3 py-[7px] text-[12px] text-left cursor-pointer transition-colors ${
                    item.danger
                      ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative max-w-[70%] min-w-[60px] text-sm break-words shadow px-2 py-1 transition-transform duration-200 ease-out ${bubbleShiftClass} ${
            isOwn
              ? "bg-emerald-100 dark:bg-emerald-900 text-black dark:text-emerald-50 rounded-tl-xl rounded-bl-xl rounded-br-xl"
              : "bg-white dark:bg-slate-800 text-black dark:text-slate-100 rounded-tr-xl rounded-br-xl rounded-bl-xl"
          }`}
        >
          {/* Sender name: group + received only */}
          {!isOwn && isGroup && !isCall && (
            <p
              className="text-[10px] font-semibold mb-[2px]"
              style={{ color: userColor }}
            >
              {message.sender?.fName}
            </p>
          )}

          {/* Reply preview */}
          {message.replyTo && (
            <div
              onClick={() => onReplyClick(message.replyTo._id)}
              className={`border-l-4 border-emerald-500 pl-2 mb-1 rounded p-1 cursor-pointer hover:opacity-80 flex items-center gap-2 min-w-0 ${
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
                    message.replyTo.content
                  ) : message.replyTo.media?.length > 0 ? (
                    <span className="flex items-center gap-1 text-gray-500">
                      <Paperclip size={12} className="opacity-70" />
                      Media
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Call bubble */}
          {isCall && (
            <CallBubble
              message={message}
              isOwn={isOwn}
              onStartCall={onStartCall}
              chat={chat}
              time={time}
            />
          )}

          {/* Deleted vs normal content */}
          {message.isDeleted ? (
            <span className="flex items-center gap-1 text-[12px] italic text-gray-400 dark:text-slate-500 px-1 py-[2px]">
              <Ban size={14} className="shrink-0" />
              {message.deletedBy?.toString() === user?._id?.toString() || isOwn
                ? "You deleted this message"
                : "This message was deleted"}
            </span>
          ) : (
            <>
              {!isCall && message.content && (
                <span className="whitespace-pre-wrap break-all text-[13px] leading-relaxed">
                  {renderMessage(message.content)}
                </span>
              )}

              {!isCall &&
                message.media.map((m, i) => (
                  <MediaRenderer
                    key={i}
                    media={m}
                    uploading={message.uploading}
                    setPreviewImage={setPreviewImage}
                    isOwn={isOwn}
                  />
                ))}
            </>
          )}

          {/* Time + tick (non-call only) */}
          {!isCall && (
            <div className="flex justify-end items-center gap-1 mt-[2px]">
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

          {/* Bubble tail */}
          <div
            className={`absolute top-0 w-0 h-0 ${
              isOwn
                ? "right-[-6px] border-l-[8px] border-l-emerald-100 dark:border-l-emerald-900 border-b-[8px] border-b-transparent"
                : "left-[-6px] border-r-[8px] border-r-white dark:border-r-slate-800 border-b-[8px] border-b-transparent"
            }`}
          />
        </div>
      </div>
    </>
  );
};

const CallBubble = ({ message, isOwn, onStartCall, chat, time }) => {
  const { callType, status, duration = 0 } = message.callData || {};
  const isIncoming = !isOwn;
  const participantsCount = message?.participants?.length || 0;
  const isGroup = !!(
    message?.chat?.chatName ||
    (!message?.chat?.chatName && participantsCount > 2)
  );
  const isVideo = callType === "video";

  const formatDuration = (sec) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  const isMissed = status === "missed" && isIncoming;
  const isCompleted = status === "completed";

  const iconColor = isMissed
    ? "text-red-500"
    : isCompleted
    ? "text-emerald-500"
    : "text-slate-400 dark:text-slate-300";

  const ringClass = isOwn
    ? "bg-emerald-500/10 border border-emerald-500/15 shadow-[0_1px_0_rgba(16,185,129,0.08)]"
    : "bg-slate-800/70 border border-slate-700/80 shadow-[0_1px_0_rgba(255,255,255,0.03)]";

  const innerClass = isOwn
    ? "bg-emerald-950/35 hover:bg-emerald-950/45"
    : "bg-slate-850/90 hover:bg-slate-800";

  const statusLabel = (() => {
    if (isGroup && !message?.chat?.chatName) {
      return `${Math.max(participantsCount - 1, 0)} invited`;
    }
    if (status === "missed") return isIncoming ? "Missed call" : "No answer";
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
    <div className={`p-[1px] rounded-[18px] ${ringClass}`}>
      <div
        onClick={handleCall}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-[17px] min-w-[190px] max-w-[250px] cursor-pointer active:scale-[0.99] transition-colors duration-200 ${innerClass}`}
      >
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0
            ${isOwn ? "bg-emerald-500/10" : "bg-slate-700/70"}`}
        >
          {isVideo ? (
            <Video size={16} className={iconColor} />
          ) : (
            <PhoneCall size={16} className={iconColor} />
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {isIncoming ? (
              <ArrowDownLeft size={11} className="text-slate-400 shrink-0" />
            ) : (
              <ArrowUpRight size={11} className="text-slate-400 shrink-0" />
            )}

            <span className="text-[12px] font-semibold text-slate-100 truncate">
              {isGroup
                ? isVideo
                  ? "Group video call"
                  : "Group audio call"
                : isVideo
                ? "Video call"
                : "Audio call"}
            </span>
          </div>

          <span className="text-[10px] text-slate-400 mt-[1px] pl-[15px] truncate">
            {statusLabel}
          </span>
        </div>

        <div className="flex flex-col items-end gap-[2px] shrink-0 self-end pb-[1px]">
          <span className="text-[9px] text-slate-400 whitespace-nowrap">
            {time}
          </span>
          {isOwn &&
            (message.readBy?.length > 1 ? (
              <BsCheckAll color="#34d399" size={12} />
            ) : (
              <BsCheck color="gray" size={12} />
            ))}
        </div>
      </div>
    </div>
  );
};

// ─── MediaRenderer ────────────────────────────────────────────────────────────
const MediaRenderer = ({ media, uploading, setPreviewImage, isOwn }) => {
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
    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/40 rounded-lg">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isImage)
    return (
      <div className="relative w-full">
        <img
          src={url}
          alt="media"
          onClick={() => !uploading && setPreviewImage(url)}
          className="w-full max-h-[250px] rounded-lg cursor-pointer hover:opacity-90 object-cover"
        />
        {uploading && uploadingOverlay}
      </div>
    );

  if (isVideo)
    return (
      <div className="relative w-full">
        <video
          controls
          className="w-full max-h-[250px] rounded-lg object-cover"
        >
          <source src={url} />
        </video>
        {uploading && uploadingOverlay}
      </div>
    );

  if (isAudio)
    return (
      <div className="w-full">
        <AudioPlayer url={url} />
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
      <span className="text-sm truncate break-all text-gray-800 dark:text-slate-200">
        {name}
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
