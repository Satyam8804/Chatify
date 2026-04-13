import { useState, useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";
import {
  getBackgroundsForPicker,
  setChatBackground,
  setDefaultBackground,
} from "../../api/background.api.js";
import PresetPickerGrid from "./PresetPickerGrid.jsx";
import MyUploadsPicker from "./MyUploadsPicker.jsx";

const TABS = ["Presets", "My Uploads"];

const BackgroundPickerDrawer = ({ open, onClose, chat, setSelectedChat }) => {
  const [activeTab, setActiveTab] = useState("Presets");
  const [selected, setSelected] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyScope, setApplyScope] = useState("chat");
  const [presets, setPresets] = useState([]); // ← local state
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    const loadPicker = async () => {
      setLoading(true);
      try {
        const { data } = await getBackgroundsForPicker();
        setPresets(data.presets);
      } finally {
        setLoading(false);
      }
    };
    loadPicker();
  }, [open]);

  const handleApply = async () => {
    if (selected === undefined) return;
    setApplying(true);
    try {
      const payload =
        selected === null
          ? { backgroundType: null, backgroundRef: null }
          : {
              backgroundType: selected.backgroundType,
              backgroundRef: selected.backgroundRef,
            };

      if (applyScope === "chat") {
        await setChatBackground(chat._id, payload);

        // ✅ update chat in parent state so background applies instantly
        setSelectedChat((prev) => ({
          ...prev,
          backgroundOverride: {
            backgroundType: payload.backgroundType,
            backgroundRef: selected ? { assetUrl: selected.previewUrl } : null,
          },
        }));
      } else {
        await setDefaultBackground(payload);
      }

      onClose();
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 animate-menu">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Chat Background
          </h2>
        </div>
      </div>

      {/* Apply scope toggle */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
          Apply to
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setApplyScope("chat")}
            className={`flex-1 text-xs py-2 rounded-lg border transition font-medium ${
              applyScope === "chat"
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300"
            }`}
          >
            This Chat
          </button>
          <button
            onClick={() => setApplyScope("global")}
            className={`flex-1 text-xs py-2 rounded-lg border transition font-medium ${
              applyScope === "global"
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300"
            }`}
          >
            All Chats
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-sm py-3 font-medium transition-colors ${
              activeTab === tab
                ? "text-emerald-500 border-b-2 border-emerald-500"
                : "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Preview strip */}
      {selected?.previewUrl && (
        <div className="relative h-24 w-full overflow-hidden shrink-0">
          <img
            src={selected.previewUrl}
            alt="preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <p className="text-white text-xs font-medium">Preview</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4">
        {activeTab === "Presets" ? (
          <PresetPickerGrid
            selected={selected}
            onSelect={setSelected}
            presets={presets} // ← add
            loading={loading} // ← add
          />
        ) : (
          <MyUploadsPicker
            selected={selected}
            onSelect={setSelected}
            chat={chat}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 text-sm py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={selected === undefined || applying}
          className="flex-1 text-sm py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
        >
          {applying
            ? "Applying..."
            : applyScope === "chat"
            ? "Apply to Chat"
            : "Apply to All Chats"}
        </button>
      </div>
    </div>
  );
};

export default BackgroundPickerDrawer;
