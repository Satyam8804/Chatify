import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";
import { Send, Plus, X, Image, Music, Video, FileText } from "lucide-react";
import { useAuth } from "../../context/authContext";
import { logger } from "../../utils/logger";
import sentSound from "../../assets/sound/sent.mp3";

const MessageInput = ({ chatId, onMessageSent, setReplyTo, replyTo }) => {
  const [message, setMessage] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const soundRef = useRef(new Audio(sentSound));

  const { socket } = useSocket();
  const { user } = useAuth();

  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  const sendMessage = async () => {
    if (!message.trim() && selectedFiles.length === 0) return;

    try {
      // TEXT MESSAGE
      if (message.trim()) {
        const res = await api.post("/messages", {
          chatId,
          content: message,
          replyTo: replyTo?._id || null, // ✅
        });
        const newMessage = res.data;
        onMessageSent(newMessage);
        socket.emit("new-message", newMessage);
        soundRef.current.currentTime = 0;
        soundRef.current.play();
      }

      // MEDIA MESSAGES
      for (const { file, preview } of selectedFiles) {
        const tempId = Date.now() + Math.random();

        const tempMessage = {
          _id: tempId,
          sender: { _id: user._id },
          chat: chatId,
          media: [{ url: preview, name: file.name, type: file.type }],
          uploading: true,
          createdAt: new Date(),
          replyTo: replyTo || null, // ✅
        };

        onMessageSent(tempMessage);

        const formData = new FormData();
        formData.append("files", file);
        formData.append("chatId", chatId);
        if (replyTo?._id) formData.append("replyTo", replyTo._id); // ✅

        try {
          const res = await api.post("/messages/media", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const newMessage = res.data;
          socket.emit("new-message", newMessage);
          onMessageSent({ ...newMessage, replaceId: tempId });
          soundRef.current.currentTime = 0; // ✅
          soundRef.current.play(); // ✅
        } catch (err) {
          logger(err);
        }
      }

      setSelectedFiles([]);
      setMessage("");
      setReplyTo(null); // ✅ clear reply after sending
    } catch (err) {
      logger(err.message);
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
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", { chatId, user });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket.emit("stop-typing", { chatId });
    }, 1000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-4 py-3 flex flex-col gap-2 transition-colors">
      {/* MEDIA PREVIEW */}
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
                  onClick={() =>
                    setSelectedFiles((prev) =>
                      prev.filter((_, i) => i !== index)
                    )
                  }
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* INPUT BAR */}
      <div className="flex items-center gap-2">
        {/* Attachment Menu */}
        <div className="relative" ref={menuRef}>
          {showMenu && (
            <div className="absolute bottom-14 left-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-xl w-44 p-1.5 space-y-0.5 animate-menu z-10">
              <button
                onClick={() => {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                }}
                className="flex gap-1 w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                <Image /> Image
              </button>
              <button
                onClick={() => {
                  fileInputRef.current.accept = "video/*";
                  fileInputRef.current.click();
                }}
                className="flex w-full gap-1 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                <Video /> Video
              </button>
              <button
                onClick={() => {
                  fileInputRef.current.accept = "audio/*";
                  fileInputRef.current.click();
                }}
                className="flex gap-1 w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                <Music /> Audio
              </button>
              <button
                onClick={() => {
                  fileInputRef.current.accept = ".pdf,.doc,.docx,.txt";
                  fileInputRef.current.click();
                }}
                className="flex gap-1 w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                <FileText /> Document
              </button>
            </div>
          )}

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer "
          >
            <Plus size={20} />
          </button>
        </div>
        {replyTo && (
          <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-sm min-w-0">
            <div className="border-l-4 border-emerald-500 pl-2 min-w-0 flex-1">
              <p className="text-xs text-emerald-500 font-medium truncate">
                {replyTo.sender?.fName}
              </p>
              <p className="text-gray-600 dark:text-slate-300 truncate text-xs">
                {replyTo.content || "📎 Media"}
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
          placeholder="Type a message..."
          onKeyDown={handleKeyDown}
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
