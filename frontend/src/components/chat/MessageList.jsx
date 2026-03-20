import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/authContext";
import Avatar from "../common/Avatar";
import { useSocket } from "../../context/socketContext";
import TypingIndicator from "./TypingIndicator";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import { Copy, Check, Reply } from "lucide-react";
import { getAvatarColor } from "../../utils/getAvatarColor";
import { FaFilePdf } from "react-icons/fa";
import AudioPlayer from "./AudioPlayer";
import ImagePreview from "./ImagePreview";
import {
  Phone,
  PhoneCall,
  PhoneMissed,
  Video,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

const MessageList = ({ messages, onReply, onStartCall, chat }) => {
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const { typingUser } = useSocket();
  const [previewImage, setPreviewImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const messageRefs = useRef({});

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
    <div className="h-full overflow-y-auto hide-scrollbar p-2 pb-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      {messages.map((msg) => (
        <MessageBubble
          key={msg._id}
          message={msg}
          setPreviewImage={setPreviewImage}
          copiedId={copiedId}
          setCopiedId={setCopiedId}
          isOwn={msg.sender?._id === user?._id}
          onReply={onReply}
          messageRefs={messageRefs}
          onReplyClick={handleReplyClick}
          onStartCall={onStartCall}
          chat={chat}
        />
      ))}
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
  copiedId,
  setCopiedId,
  setPreviewImage,
  onReply,
  onReplyClick,
  messageRefs,
  onStartCall,
  chat,
}) => {
  const userColor = !isOwn
    ? getAvatarColor(message.sender?._id || message.sender?.fName)
    : "";

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(message._id);
    setTimeout(() => setCopiedId(null), 1500);
  };

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

  return (
    <div
      ref={(el) => {
        if (el) messageRefs.current[message._id] = el;
      }}
      className={`group flex mb-2 items-center gap-1 ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar - received messages */}
      {!isOwn && (
        <div className="self-start mt-1">
          <Avatar user={message?.sender} size={24} IsInside />
        </div>
      )}

      {/* Reply Button - own messages (left of bubble) */}
      {isOwn && (
        <button
          onClick={() => onReply(message)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-500 cursor-pointer p-1"
        >
          <Reply size={14} />
        </button>
      )}

      {/* Message Bubble */}
      <div
        className={`relative max-w-[70%] min-w-[60px] px-2 py-1 text-sm shadow break-words
          ${
            isOwn
              ? "bg-emerald-100 dark:bg-emerald-900 text-black dark:text-emerald-50 rounded-tl-sm rounded-bl-sm rounded-br-sm"
              : "bg-white dark:bg-slate-800 text-black dark:text-slate-100 rounded-tr-sm rounded-br-sm rounded-bl-sm"
          }`}
      >
        {/* Sender Name */}
        {!isOwn && (
          <p
            className="text-[10px] font-semibold mb-[2px]"
            style={{ color: userColor }}
          >
            {message.sender?.fName}
          </p>
        )}

        {/* REPLY PREVIEW */}
        {message.replyTo && (
          <div
            onClick={() => onReplyClick(message.replyTo._id)}
            className={`border-l-4 border-emerald-500 pl-2 mb-1 rounded p-1 cursor-pointer hover:opacity-80 flex items-center gap-2 min-w-0
      ${
        isOwn
          ? "bg-emerald-200/50 dark:bg-emerald-800/50"
          : "bg-gray-100 dark:bg-slate-700"
      }`}
          >
            {/* thumbnail */}
            {message.replyTo.media?.length > 0 &&
              (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
                message.replyTo.media[0].name?.split(".").pop()?.toLowerCase()
              ) || message.replyTo.media[0].type?.startsWith("image/") ? (
                <img
                  src={message.replyTo.media[0].url}
                  className="w-10 h-10 rounded object-cover shrink-0"
                />
              ) : (
                <span className="shrink-0">📎</span>
              ))}

            {/* text */}
            <div className="min-w-0 flex-1">
              <p className="text-emerald-500 font-medium text-[10px] truncate">
                {message.replyTo.sender?.fName}
              </p>
              <div className="text-gray-500 dark:text-slate-400 truncate text-[11px] flex items-center gap-2">
                {message.replyTo.messageType === "call"
                  ? (() => {
                      const {
                        status,
                        callType: type,
                        duration = 0,
                      } = message.replyTo.callData || {};

                      const isIncoming =
                        message.replyTo.sender?._id !== message.sender?._id;

                      let colorClass = "text-gray-400";

                      if (status === "missed" && isIncoming) {
                        colorClass = "text-red-500";
                      } else if (status === "completed") {
                        colorClass = "text-green-500";
                      }

                      return (
                        <>
                          {/* ICON */}
                          {type === "video" ? (
                            <Video size={12} className={colorClass} />
                          ) : (
                            <PhoneCall size={12} className={colorClass} />
                          )}

                          {/* TEXT */}
                          <span>
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

                          {/* DURATION */}
                          {duration > 0 && (
                            <span className="ml-1 text-[10px] text-gray-400">
                              • {Math.floor(duration / 60)}:
                              {(duration % 60).toString().padStart(2, "0")}
                            </span>
                          )}
                        </>
                      );
                    })()
                  : message.replyTo.content ||
                    (message.replyTo.media?.length > 0 ? "📎 Media" : "")}
              </div>
            </div>
          </div>
        )}

        {message.messageType === "call" && (
          <CallBubble
            message={message}
            isOwn={isOwn}
            onStartCall={onStartCall}
            chat={chat}
          />
        )}

        {/* TEXT MESSAGE */}
        {message.messageType !== "call" && message.content && (
          <div className="flex gap-2 items-end">
            <span className="whitespace-pre-wrap break-all text-[13px] leading-relaxed">
              {renderMessage(message.content)}
            </span>
            <span
              className="cursor-pointer opacity-0 group-hover:opacity-100 transition text-gray-400 dark:text-slate-500 hover:text-black dark:hover:text-white"
              onClick={() => copyMessage(renderMessage(message.content))}
            >
              {copiedId === message._id ? (
                <Check size={12} />
              ) : (
                <Copy size={12} />
              )}
            </span>
          </div>
        )}

        {/* MEDIA MESSAGE */}
        {message.messageType !== "call" &&
          message.media.map((m, i) => (
            <MediaRenderer
              key={i}
              media={m}
              uploading={message.uploading}
              setPreviewImage={setPreviewImage}
              isOwn={isOwn}
            />
          ))}

        {/* Time + Tick */}
        <div className="flex justify-end items-center gap-1 mt-1">
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

        {/* Bubble Tail */}
        <div
          className={`absolute top-0 w-0 h-0
            ${
              isOwn
                ? "right-[-8px] border-l-[10px] border-l-emerald-100 dark:border-l-emerald-900 border-b-[10px] border-b-transparent"
                : "left-[-8px] border-r-[10px] border-r-white dark:border-r-slate-800 border-b-[10px] border-b-transparent"
            }`}
        />
      </div>

      {!isOwn && (
        <button
          onClick={() => onReply(message)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-500 cursor-pointer p-1"
        >
          <Reply size={14} />
        </button>
      )}
    </div>
  );
};

const CallBubble = ({ message, isOwn, onStartCall, chat }) => {
  if (!message || message.messageType !== "call") return null;

  const callData = message.callData || {};
  const { callType, status, duration = 0 } = callData;

  const isIncoming = !isOwn;

  const formatDuration = (sec) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  let colorClass = "text-gray-400";
  if (status === "missed" && isIncoming) colorClass = "text-red-500";
  else if (status === "completed") colorClass = "text-green-500";

  const handleCall = (e) => {
    e.stopPropagation();
    console.log("!message?.chat", !message?.chat);
    console.log("fullChat ", chat);
    if (!message?.chat) return;
    onStartCall?.(chat, callType);
  };

  const participantsCount = message?.participants?.length || 0;

  const isGroup = participantsCount > 1 || message?.chat?.isGroup;

  const isVideo = message?.callData?.callType === "video";
  return (
    <div
      onClick={handleCall}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg w-fit min-w-[180px] cursor-pointer transition-opacity active:opacity-70
        ${
          isOwn
            ? "bg-emerald-200 dark:bg-emerald-800 hover:bg-emerald-300/80 dark:hover:bg-emerald-700/80"
            : "bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600"
        }`}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-slate-600 shrink-0">
        {isVideo ? (
          <Video size={16} className={colorClass} />
        ) : (
          <PhoneCall size={16} className={colorClass} />
        )}
      </div>

      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-center gap-1.5">
          {isIncoming ? (
            <ArrowDownLeft size={13} className="text-slate-400 shrink-0" />
          ) : (
            <ArrowUpRight size={13} className="text-slate-400 shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {isGroup
              ? isVideo
                ? "Group video call"
                : "Group audio call"
              : isVideo
              ? "Video call"
              : "Audio call"}
          </span>
        </div>

        <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-5">
          {status === "missed"
            ? isIncoming
              ? "Missed"
              : "No answer"
            : status === "completed"
            ? duration > 0
              ? formatDuration(duration)
              : "Ended"
            : "Declined"}
        </span>
      </div>
    </div>
  );
};

const MediaRenderer = ({ media, uploading, setPreviewImage, isOwn }) => {
  const url = media?.url || "";
  const name = media?.name || "";
  const extension = name.split(".").pop()?.toLowerCase();

  // ✅ fallback to mime type for blob URLs during upload
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

  if (isImage) {
    return (
      <div className="relative w-full">
        <img
          src={url}
          alt="media"
          onClick={() => !uploading && setPreviewImage(url)}
          className="w-full max-h-[250px] rounded-lg cursor-pointer hover:opacity-90 object-cover" // ✅ max-h-[250px]
        />
        {uploading && uploadingOverlay}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="relative w-full">
        <video
          controls
          className="w-full max-h-[250px] rounded-lg object-cover" // ✅ constrain video directly
        >
          <source src={url} />
        </video>
        {uploading && uploadingOverlay}
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="w-full">
        {" "}
        <AudioPlayer url={url} />
      </div>
    );
  }

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

export default MessageList;
