import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/authContext";
import Avatar from "../common/Avatar";
import { useSocket } from "../../context/socketContext";
import TypingIndicator from "./TypingIndicator";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import { FiCopy } from "react-icons/fi";
import { getAvatarColor } from "../../utils/getAvatarColor";
import { FaFilePdf, FaFileAlt } from "react-icons/fa";
import AudioPlayer from "./AudioPlayer";
import ImagePreview from "./ImagePreview";

const MessageList = ({ messages }) => {
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const { typingUser } = useSocket();
  const [previewImage, setPreviewImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto hide-scrollbar p-4 bg-[#ECE5DD]">
      {messages.map((msg) => (
        <MessageBubble
          key={msg._id}
          message={msg}
          setPreviewImage={setPreviewImage}
          copiedId={copiedId}
          setCopiedId={setCopiedId}
          isOwn={msg.sender?._id === user?._id}
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
}) => {
  const userColor = !isOwn
    ? getAvatarColor(message.sender?._id || message.sender?.fName)
    : "";

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(message._id);

    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"}`}>
      {/* Avatar */}
      {!isOwn && (
        <div className="mr-2">
          <Avatar user={message?.sender} size={24} IsInside />
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`group relative max-w-[65%] px-2 py-1 text-sm shadow break-words
        ${
          isOwn
            ? "bg-[#DCF8C6] text-black rounded-tl-sm rounded-bl-sm rounded-br-sm"
            : "bg-white text-black rounded-tr-sm rounded-br-sm rounded-bl-sm"
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

        {/* TEXT MESSAGE */}
        {message.content && (
          <div className="flex gap-2 items-end">
            <span className="whitespace-pre-wrap break-all text-[13px] leading-relaxed">
              {message.content}
            </span>

            <span
              className="cursor-pointer opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-black"
              onClick={() => copyMessage(message.content)}
            >
              {copiedId === message._id ? (
                <BsCheck size={14} />
              ) : (
                <FiCopy size={12} className="rotate-90" />
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
          />
        ))}

        {/* Time + Tick */}
        <div className="flex justify-end items-center gap-1 mt-1">
          <span className="text-[9px] text-gray-500">{time}</span>

          {isOwn && (
            <>
              {message.readBy?.length > 1 ? (
                <BsCheckAll color="#4FC3F7" size={14} />
              ) : (
                <BsCheck color="grey" size={14} />
              )}
            </>
          )}
        </div>

        {/* Bubble Tail */}
        <div
          className={`absolute top-0 w-0 h-0
          ${
            isOwn
              ? "right-[-8px] border-l-[10px] border-l-[#DCF8C6] border-b-[10px] border-b-transparent"
              : "left-[-8px] border-r-[10px] border-r-white border-b-[10px] border-b-transparent"
          }`}
        />
      </div>
    </div>
  );
};

/* MEDIA RENDERER */

const MediaRenderer = ({ media, uploading, setPreviewImage }) => {
  const url = media?.url || "";
  const name = media?.name || "";

  const extension = name.split(".").pop()?.toLowerCase();

  // IMAGE
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return (
      <div className="relative group max-w-[70vw] sm:max-w-[300px]">
        <img
          src={url}
          alt="media"
          onClick={() => setPreviewImage(url)}
          className="w-full h-auto rounded-lg cursor-pointer hover:opacity-90 object-cover"
        />

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    );
  }

  // VIDEO
  if (["mp4", "webm", "mov"].includes(extension)) {
    return (
      <div className="relative max-w-[70vw] sm:max-w-[300px]">
        <video controls className="w-full rounded-lg cursor-pointer">
          <source src={url} />
        </video>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    );
  }

  // AUDIO
  if (["mp3", "wav", "ogg"].includes(extension)) {
    return (
      <div className="max-w-[70vw] sm:max-w-[300px]">
        <AudioPlayer url={url} />
      </div>
    );
  }

  // DOCUMENT
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative bg-gray-100 p-2 rounded-lg max-w-[70vw] sm:max-w-[250px] flex items-center gap-2 cursor-pointer hover:bg-gray-200"
    >
      <FaFilePdf color="red" size={22} />

      <span className="text-sm truncate break-all">{name}</span>

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </a>
  );
};

export default MessageList;
