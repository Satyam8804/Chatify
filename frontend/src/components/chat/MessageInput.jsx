import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { useSocket } from "../../context/socketContext";
import { IoSend } from "react-icons/io5";
import { useAuth } from "../../context/authContext";

const MessageInput = ({ chatId, onMessageSent }) => {
  const [message, setMessage] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const { socket } = useSocket();
  const { user } = useAuth(); // ✅ FIX: user was missing

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

      // MEDIA MESSAGE
      for (const { file, preview } of selectedFiles) {
        const tempId = Date.now() + Math.random();

        const tempMessage = {
          _id: tempId,
          sender: { _id: user._id },
          chat: chatId,
          media: [
            {
              url: preview,
              name: file.name,
            },
          ],
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

          // replace preview message
          onMessageSent({
            ...newMessage,
            replaceId: tempId,
          });
        } catch (err) {
          console.log(err);
        }
      }

      setSelectedFiles([]);
      setMessage("");
    } catch (err) {
      console.log(err);
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
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
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

  return (
    <div className="bg-[#ECE5DD] p-2 flex flex-col gap-2 ">
      {/* MEDIA PREVIEW */}
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {/* First Image Large */}
          <div className="relative m-2">
            <img
              src={selectedFiles[0].preview}
              alt="preview"
              className="w-24 h-24 object-cover rounded-lg"
            />

            <button
              onClick={() =>
                setSelectedFiles((prev) => prev.filter((_, i) => i !== 0))
              }
              className="absolute -top-1 -right-1 bg-gray-500 cursor-pointer text-white text-xs px-1 rounded-full"
            >
              ✕
            </button>
          </div>

          {/* Remaining previews */}
          {selectedFiles.slice(1, 4).map((item, index) => (
            <div key={index} className="relative">
              <img
                src={item.preview}
                alt="preview"
                className="w-16 h-16 object-cover rounded-md"
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
      <div className="flex items-center gap-2 w-full px-1 py-1 border-2 border-gray-600 rounded-full ">
        {/* Attachment Menu */}
        <div className="relative" ref={menuRef}>
          {showMenu && (
            <div className="absolute bottom-12 left-0 bg-white shadow-xl rounded-lg w-40 p-2 space-y-1 animate-menu">
              <button
                onClick={() => {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                }}
                className="flex w-full px-3 py-2 cursor-pointer hover:bg-gray-100 rounded"
              >
                🖼 Image
              </button>

              <button
                onClick={() => {
                  fileInputRef.current.accept = "video/*";
                  fileInputRef.current.click();
                }}
                className="flex w-full px-3 py-2 cursor-pointer hover:bg-gray-100 rounded"
              >
                🎥 Video
              </button>

              <button
                onClick={() => {
                  fileInputRef.current.accept = "audio/*";
                  fileInputRef.current.click();
                }}
                className="flex w-full px-3 py-2 cursor-pointer hover:bg-gray-100 rounded"
              >
                🎵 Audio
              </button>

              <button
                onClick={() => {
                  fileInputRef.current.accept = ".pdf,.doc,.docx,.txt";
                  fileInputRef.current.click();
                }}
                className="flex w-full px-3 py-2 cursor-pointer hover:bg-gray-100 rounded"
              >
                📄 Document
              </button>
            </div>
          )}

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-9 h-9 flex items-center cursor-pointer justify-center text-xl"
          >
            <span className="text-3xl">+</span>
          </button>
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 outline-none text-sm"
        />

        {/* Send Button */}
        <button
          onClick={sendMessage}
          disabled={!message.trim() && selectedFiles.length === 0}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-600 text-white disabled:bg-gray-400"
        >
          <IoSend size={18} />
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
