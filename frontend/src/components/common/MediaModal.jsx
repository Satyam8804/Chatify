import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import ImagePreview from "../chat/ImagePreview.jsx";
import AudioPlayer from "../chat/AudioPlayer.jsx";

const TABS = ["Images", "Videos", "Audio", "Docs"];

const MediaModal = ({ messages, onClose }) => {
  const [activeTab, setActiveTab] = useState("Images");
  const [previewImage, setPreviewImage] = useState(null);

  const getExt = (msg) =>
    msg?.media?.[0]?.name?.split(".").pop()?.toLowerCase();

  const filtered = messages.filter((msg) => {
    const ext = getExt(msg);
    if (activeTab === "Images")
      return ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
    if (activeTab === "Videos") return ["mp4", "webm", "mov"].includes(ext);
    if (activeTab === "Audio") return ["mp3", "wav", "ogg"].includes(ext);
    if (activeTab === "Docs")
      return ["pdf", "doc", "docx", "txt"].includes(ext);
    return false;
  });

  return (
    <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Media & Docs
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors cursor-pointer
              ${
                activeTab === tab
                  ? "text-emerald-500 border-b-2 border-emerald-500"
                  : "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 hide-scrollbar">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
            No {activeTab.toLowerCase()} shared yet
          </div>
        ) : (
          <>
            {activeTab === "Images" && (
              <div className="grid grid-cols-3 gap-1.5">
                {filtered.map((msg) => (
                  <img
                    key={msg._id}
                    src={msg?.media?.[0]?.url}
                    alt="media"
                    onClick={() => setPreviewImage(msg?.media?.[0]?.url)}
                    className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            )}

            {activeTab === "Videos" && (
              <div className="grid grid-cols-2 gap-2">
                {filtered.map((msg) => (
                  <video key={msg._id} controls className="w-full rounded-lg">
                    <source src={msg?.media?.[0]?.url} />
                  </video>
                ))}
              </div>
            )}

            {activeTab === "Audio" && (
              <div className="space-y-2">
                {filtered.map((msg) => (
                  <div
                    key={msg._id}
                    className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3"
                  >
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 truncate">
                      {msg?.media?.[0]?.name}
                    </p>
                    <AudioPlayer url={msg?.media?.[0]?.url} /> {/* ✅ */}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Docs" && (
              <div className="space-y-2">
                {filtered.map((msg) => (
                  <a
                    key={msg._id}
                    href={msg?.media?.[0]?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <span className="text-red-500 text-xs font-bold uppercase">
                        {getExt(msg)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-800 dark:text-slate-200 truncate">
                      {msg?.media?.[0]?.name}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {previewImage && (
        <ImagePreview
          url={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
};

export default MediaModal;
