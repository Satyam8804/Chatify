import { Check } from "lucide-react";
import { useState } from "react";

const PresetPickerGrid = ({ selected, onSelect, presets, loading }) => {
  const [imageLoaded, setImageLoaded] = useState({});

  const handleSelect = (preset) => {
    onSelect({
      backgroundType: "Background",
      backgroundRef: preset._id,
      previewUrl: preset.assetUrl,
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-full h-36 rounded-xl animate-pulse bg-gray-200 dark:bg-slate-700"
          />
        ))}
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-slate-500">
        <p className="text-sm">No presets available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* None option */}
      <button
        onClick={() => onSelect(null)}
        className={`w-full h-14 rounded-xl border-2 text-sm font-medium transition flex items-center justify-center gap-2 ${
          selected === null
            ? "border-emerald-500 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
            : "border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600"
        }`}
      >
        {selected === null && <Check size={14} />}
        No Background
      </button>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {presets.map((preset) => {
          const isSelected = selected?.backgroundRef === preset._id;
          return (
            <button
              key={preset._id}
              onClick={() => handleSelect(preset)}
              className={`relative w-full h-36 rounded-xl overflow-hidden border-2 transition ${
                isSelected
                  ? "border-emerald-500 shadow-lg shadow-emerald-500/20"
                  : "border-transparent hover:border-gray-300 dark:hover:border-slate-600"
              }`}
            >
              {!imageLoaded[preset._id] && (
                <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-slate-700" />
              )}
              <img
                src={preset.thumbnailUrl}
                alt={preset.name}
                onLoad={() =>
                  setImageLoaded((prev) => ({ ...prev, [preset._id]: true }))
                }
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded[preset._id] ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}

              {/* Name on hover */}
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{preset.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PresetPickerGrid;
