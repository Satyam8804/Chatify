import { useState } from "react";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";

const PresetCard = ({ preset, onEdit, onDelete, onToggle }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-gray-900 shadow-md">
      
      {/* Thumbnail */}
      <div className="relative w-full h-40 bg-gray-800">
        {!imageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gray-700 rounded-t-xl" />
        )}
        <img
          src={preset.thumbnailUrl}
          alt={preset.name}
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${!preset.isActive ? "grayscale opacity-50" : ""}`}
        />

        {/* Hover action buttons */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
          <button
            onClick={() => onEdit(preset)}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => onToggle(preset._id)}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >
            {preset.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            onClick={() => onDelete(preset)}
            className="p-2 rounded-full bg-red-500/70 hover:bg-red-500 text-white transition"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Inactive badge */}
        {!preset.isActive && (
          <span className="absolute top-2 left-2 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            Hidden
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{preset.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400">{preset.category}</span>
          <span className="text-xs text-gray-500 capitalize">{preset.type}</span>
        </div>
        {preset.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {preset.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PresetCard;