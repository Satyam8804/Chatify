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
      }, 300);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
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
        <div className="self-end mb-1">
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
        className={`relative max-w-[65%] px-2 py-1 text-sm shadow break-words
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
            className={`border-l-4 cursor-pointer border-emerald-500 pl-2 mb-1 rounded p-1 text-[11px]
              ${
                isOwn
                  ? "bg-emerald-200/50 dark:bg-emerald-800/50"
                  : "bg-gray-100 dark:bg-slate-700"
              }`}
          >
            <p className="text-emerald-500 font-medium text-[10px]">
              {message.replyTo.sender?.fName}
            </p>
            <p className="text-gray-500 dark:text-slate-400 truncate">
              {message.replyTo.content || "📎 Media"}
            </p>
          </div>
        )}

        {/* TEXT MESSAGE */}
        {message.content && (
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
        {message.media.map((m, i) => (
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

      {/* Reply Button - received messages (right of bubble) */}
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

const MediaRenderer = ({ media, uploading, setPreviewImage, isOwn }) => {
  const url = media?.url || "";
  const name = media?.name || "";
  const extension = name.split(".").pop()?.toLowerCase();

  const uploadingOverlay = (
    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/40 rounded-lg">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return (
      <div className="relative max-w-[70vw] sm:max-w-[300px]">
        <img
          src={url}
          alt="media"
          onClick={() => setPreviewImage(url)}
          className="w-full h-auto rounded-lg cursor-pointer hover:opacity-90 object-cover"
        />
        {uploading && uploadingOverlay}
      </div>
    );
  }

  if (["mp4", "webm", "mov"].includes(extension)) {
    return (
      <div className="relative max-w-[70vw] sm:max-w-[300px]">
        <video controls className="w-full rounded-lg cursor-pointer">
          <source src={url} />
        </video>
        {uploading && uploadingOverlay}
      </div>
    );
  }

  if (["mp3", "wav", "ogg"].includes(extension)) {
    return (
      <div className="max-w-[70vw] sm:max-w-[300px]">
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
