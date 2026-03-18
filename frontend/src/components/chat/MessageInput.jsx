import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";
import { Send, Plus, X, Image, Music, Video, FileText } from "lucide-react";
import { useAuth } from "../../context/authContext";
import { logger } from "../../utils/logger";
import sentSound from "../../assets/sound/sent.mp3";
import { PhoneCall } from "lucide-react";

const MessageInput = ({ chatId, onMessageSent, setReplyTo, replyTo }) => {
  const [message, setMessage] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const soundRef = useRef(new Audio(sentSound));
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { socket } = useSocket();
  const { user } = useAuth();

  const sendMessage = async () => {
    if (!message.trim() && selectedFiles.length === 0) return;

    const currentReplyTo = replyTo;
    const currentFiles = selectedFiles;
    setMessage("");
    setSelectedFiles([]);
    setReplyTo(null);

    try {
      if (message.trim()) {
        const res = await api.post("/messages", {
          chatId,
          content: message,
          replyTo: currentReplyTo?._id || null,
        });
        const newMessage = res.data;
        onMessageSent(newMessage);
        socket.emit("new-message", newMessage);
        soundRef.current.currentTime = 0;
        soundRef.current.play();
      }

      await Promise.all(
        currentFiles.map(async ({ file, preview }) => {
          const tempId = `temp-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

          onMessageSent({
            _id: tempId,
            sender: { _id: user._id },
            chat: chatId,
            media: [{ url: preview, name: file.name, type: file.type }],
            uploading: true,
            createdAt: new Date(),
            replyTo: currentReplyTo || null,
          });

          try {
            const formData = new FormData();
            formData.append("files", file);
            formData.append("chatId", chatId);
            if (currentReplyTo?._id)
              formData.append("replyTo", currentReplyTo._id);

            const res = await api.post("/messages/media", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });

            URL.revokeObjectURL(preview);
            const newMessage = res.data;
            onMessageSent({ ...newMessage, replaceId: tempId });
            socket.emit("new-message", newMessage);
            soundRef.current.currentTime = 0;
            soundRef.current.play();
          } catch (err) {
            logger("Media upload error:", err);
            URL.revokeObjectURL(preview);
            onMessageSent({ replaceId: tempId, failed: true });
          }
        })
      );
    } catch (err) {
      logger("Send message error:", err.message);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setSelectedFiles((prev) => [...prev, ...previews]);
    setShowMenu(false);
    e.target.value = "";
  };

  useEffect(() => {
    return () => {
      selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
    };
  }, [selectedFiles]);

  const handleTyping = (e) => {
    const val = e.target.value;
    setMessage(val);
    if (val.trim()) {
      socket.emit("typing", { chatId, user });
    } else {
      socket.emit("stop-typing", { chatId });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { chatId });
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-4 py-3 flex flex-col gap-2 transition-colors">
      {/* Media Preview */}
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {selectedFiles.map((item, index) => {
            const ext = item.file.name.split(".").pop()?.toLowerCase();
            const isImage =
              ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext) ||
              item.file.type.startsWith("image/");
            const isVideo =
              ["mp4", "webm", "mov"].includes(ext) ||
              item.file.type.startsWith("video/");
            const isAudio =
              ["mp3", "wav", "ogg"].includes(ext) ||
              item.file.type.startsWith("audio/");

            return (
              <div
                key={index}
                className="relative shrink-0 m-1 w-16 h-16 rounded-lg bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex flex-col items-center justify-center gap-1"
              >
                {isImage ? (
                  <img
                    src={item.preview}
                    alt="preview"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : isVideo ? (
                  <video className="w-full h-full object-cover rounded-lg">
                    <source src={item.preview} />
                  </video>
                ) : isAudio ? (
                  <Music size={22} className="text-green-400" />
                ) : (
                  <FileText size={22} className="text-red-400" />
                )}
                <span className="text-[9px] text-gray-500 dark:text-slate-400 truncate w-14 text-center px-1">
                  {item.file.name}
                </span>
                <button
                  onClick={() => {
                    const removed = selectedFiles[index];
                    URL.revokeObjectURL(removed.preview);
                    setSelectedFiles((prev) =>
                      prev.filter((_, i) => i !== index)
                    );
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-center gap-2">
        {/* Attachment Menu */}
        <div className="relative" ref={menuRef}>
          {showMenu && (
            <div className="absolute bottom-14 left-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-xl w-44 p-1.5 space-y-0.5 animate-menu z-10">
              {[
                {
                  label: "Image",
                  accept: "image/*",
                  icon: <Image size={14} className="text-blue-500" />,
                  bg: "bg-blue-100 dark:bg-blue-500/20",
                  hover: "hover:bg-blue-50",
                },
                {
                  label: "Video",
                  accept: "video/*",
                  icon: <Video size={14} className="text-purple-500" />,
                  bg: "bg-purple-100 dark:bg-purple-500/20",
                  hover: "hover:bg-purple-50",
                },
                {
                  label: "Audio",
                  accept: "audio/*",
                  icon: <Music size={14} className="text-green-500" />,
                  bg: "bg-green-100 dark:bg-green-500/20",
                  hover: "hover:bg-green-50",
                },
                {
                  label: "Document",
                  accept: ".pdf,.doc,.docx,.txt",
                  icon: <FileText size={14} className="text-red-500" />,
                  bg: "bg-red-100 dark:bg-red-500/20",
                  hover: "hover:bg-red-50",
                },
              ].map(({ label, accept, icon, bg, hover }) => (
                <button
                  key={label}
                  onClick={() => {
                    fileInputRef.current.accept = accept;
                    fileInputRef.current.click();
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm cursor-pointer ${hover} dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg`}
                >
                  <div
                    className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center shrink-0`}
                  >
                    {icon}
                  </div>
                  {label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Reply Preview */}
        {replyTo && (
          <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-sm min-w-0">
            <div className="border-l-4 border-emerald-500 pl-2 min-w-0 flex-1">
              <p className="text-xs text-emerald-500 font-medium truncate">
                {replyTo.sender?.fName}
              </p>
              <p className="text-gray-600 dark:text-slate-300 truncate text-xs flex items-center gap-1">
                {replyTo.messageType === "call" ? (
                  <>
                    {replyTo.callData?.callType === "video" ? (
                      <Video size={12} />
                    ) : (
                      <PhoneCall size={12} />
                    )}

                    <span>
                      {replyTo.callData?.status === "missed"
                        ? "Missed call"
                        : replyTo.callData?.callType === "video"
                        ? "Video call"
                        : "Voice call"}
                    </span>
                  </>
                ) : (
                  replyTo.content || "📎 Media"
                )}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="ml-2 shrink-0 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Text Input */}
        <input
          type="text"
          value={message}
          onChange={handleTyping}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 rounded-full text-sm bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
        />

        {/* Send Button */}
        <button
          onClick={sendMessage}
          disabled={!message.trim() && selectedFiles.length === 0}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white transition-colors cursor-pointer shrink-0"
        >
          <Send size={16} />
        </button>

        <input
          type="file"
          hidden
          multiple
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
};

export default MessageInput;
