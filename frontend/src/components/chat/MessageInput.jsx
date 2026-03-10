import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";
import { Send, Plus, X } from "lucide-react";
import { useAuth } from "../../context/authContext";
import { logger } from "../../utils/logger";

const MessageInput = ({ chatId, onMessageSent }) => {
  const [message, setMessage] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

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
        });
        const newMessage = res.data;
        onMessageSent(newMessage);
        socket.emit("new-message", newMessage);
      }

      // MEDIA MESSAGES
      for (const { file, preview } of selectedFiles) {
        const tempId = Date.now() + Math.random();

        const tempMessage = {
          _id: tempId,
          sender: { _id: user._id },
          chat: chatId,
          media: [{ url: preview, name: file.name }],
          uploading: true,
          createdAt: new Date(),
        };

        // show preview immediately
        onMessageSent(tempMessage);

        const formData = new FormData();
        formData.append("files", file);
        formData.append("chatId", chatId);

        try {
          const res = await api.post("/messages/media", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const newMessage = res.data;
          socket.emit("new-message", newMessage);
          // replace preview with real message
          onMessageSent({ ...newMessage, replaceId: tempId });
        } catch (err) {
          logger(err);
        }
      }

      setSelectedFiles([]);
      setMessage("");
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
          {/* First image large */}
          <div className="relative shrink-0 m-1">
            <img
              src={selectedFiles[0].preview}
              alt="preview"
              className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-slate-600"
            />
            <button
              onClick={() =>
                setSelectedFiles((prev) => prev.filter((_, i) => i !== 0))
              }
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>

          {/* Remaining previews */}
          {selectedFiles.slice(1, 4).map((item, index) => (
            <div key={index} className="relative shrink-0">
              <img
                src={item.preview}
                alt="preview"
                className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-slate-600"
              />
              {index === 2 && selectedFiles.length > 4 && (
                <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center text-sm rounded-md">
                  +{selectedFiles.length - 4}
                </div>
              )}
            </div>
          ))}
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
                className="flex w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                🖼 Image
              </button>
              <button
                onClick={() => {
                  fileInputRef.current.accept = "video/*";
                  fileInputRef.current.click();
                }}
                className="flex w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                🎥 Video
              </button>
              <button
                onClick={() => {
                  fileInputRef.current.accept = "audio/*";
                  fileInputRef.current.click();
                }}
                className="flex w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                🎵 Audio
              </button>
              <button
                onClick={() => {
                  fileInputRef.current.accept = ".pdf,.doc,.docx,.txt";
                  fileInputRef.current.click();
                }}
                className="flex w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg"
              >
                📄 Document
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
