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

const MessageList = ({ messages, onReply }) => {
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
        className={`relative max-w-[%] px-2 py-1 text-sm shadow break-words
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
              <p className="text-gray-500 dark:text-slate-400 truncate text-[11px]">
                {message.replyTo.messageType === "call" ? (
                  <div className="flex items-center gap-1">
                    {message.replyTo.callData?.callType === "video" ? (
                      <Video
                        size={12}
                        className="text-gray-500 dark:text-slate-400"
                      />
                    ) : (
                      <PhoneCall
                        size={12}
                        className="text-gray-500 dark:text-slate-400"
                      />
                    )}

                    <span>
                      {message.replyTo.callData?.status === "missed"
                        ? "Missed call"
                        : message.replyTo.callData?.callType === "video"
                        ? "Video call"
                        : "Voice call"}
                    </span>
                  </div>
                ) : (
                  message.replyTo.content ||
                  (message.replyTo.media?.length > 0 ? "📎 Media" : "")
                )}
              </p>
            </div>
          </div>
        )}

        {message.messageType === "call" && (
          <CallBubble message={message} isOwn={isOwn} />
        )}

        {/* TEXT MESSAGE */}
        {message.messageType !== "call" && message.content && (
          <div className="flex gap-2 items-end">
            <span className="whitespace-pre-wrap break-all text-[13px] leading-relaxed">
              {message.content}
            </span>
            <span
              className="cursor-pointer opacity-0 group-hover:opacity-100 transition text-gray-400 dark:text-slate-500 hover:text-black dark:hover:text-white"
              onClick={() => copyMessage(message.content)}
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

const CallBubble = ({ message, isOwn }) => {
  const { callType, status, duration } = message.callData || {};
  const isIncoming = !isOwn;

  const getIcon = () => {
    if (status === "missed") return <PhoneMissed size={16} />;
    if (callType === "video") return <Video size={16} />;
    return <PhoneCall size={16} />;
  };

  const getText = () => {
    if (status === "missed" && isIncoming) return "Missed call";
    if (status === "missed" && !isIncoming) return "Call not answered";
    if (status === "rejected") return "Call declined";
    if (status === "completed") return "Call ended";
    return callType === "video" ? "Video call" : "Voice call";
  };

  const formatDuration = (sec) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg w-fit min-w-[180px]
        ${
          isOwn
            ? "bg-emerald-200 dark:bg-emerald-800"
            : "bg-gray-100 dark:bg-slate-700"
        }`}
    >
      {/* ICON */}
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full
          ${
            status === "missed"
              ? "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200"
              : "bg-white text-slate-700 dark:bg-slate-600 dark:text-slate-200"
          }`}
      >
        {getIcon()}
      </div>

      {/* TEXT */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          {/* Direction */}
          {isIncoming ? (
            <ArrowDownLeft
              size={14}
              className="text-gray-400 dark:text-slate-400"
            />
          ) : (
            <ArrowUpRight
              size={14}
              className="text-gray-400 dark:text-slate-400"
            />
          )}

          {/* Text */}
          <span className="font-medium text-sm text-gray-800 dark:text-slate-200">
            {getText()}
          </span>
        </div>

        {duration > 0 && (
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {formatDuration(duration)}
          </span>
        )}
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
