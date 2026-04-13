import { useEffect, useState } from "react";
import { useBackground } from "../../context/backgoundContext.jsx";
import PresetCard from "./PresetCard.jsx";

const CATEGORIES = ["All", "Nature", "Abstract", "Minimal", "Dark", "Light", "Other"];
const TYPES = ["All", "image", "gradient", "solid_color"];

const PresetGrid = ({ onEdit, onDelete }) => {
  const { presets, loading, fetchPresets, togglePreset } = useBackground();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    const filters = {};
    if (selectedCategory !== "All") filters.category = selectedCategory;
    if (selectedType !== "All") filters.type = selectedType;
    if (!showInactive) filters.isActive = true;
    fetchPresets(filters);
  }, [selectedCategory, selectedType, showInactive]);

  return (
    <div className="space-y-6">

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                selectedCategory === cat
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-white/10 text-gray-400 hover:border-white/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="ml-auto text-xs bg-gray-800 border border-white/10 text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type === "All" ? "All Types" : type.replace("_", " ")}
            </option>
          ))}
        </select>

        {/* Show/hide inactive toggle */}
        <button
          onClick={() => setShowInactive((prev) => !prev)}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            showInactive
              ? "border-white/10 text-gray-400 hover:border-white/30"
              : "bg-gray-700 border-gray-600 text-white"
          }`}
        >
          {showInactive ? "Hide Inactive" : "Show All"}
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden border border-white/10 bg-gray-900"
            >
              <div className="w-full h-40 animate-pulse bg-gray-700" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-700 animate-pulse rounded w-3/4" />
                <div className="h-3 bg-gray-700 animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : presets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <p className="text-lg font-medium">No backgrounds found</p>
          <p className="text-sm mt-1">Try changing filters or upload a new preset</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {presets.map((preset) => (
            <PresetCard
              key={preset._id}
              preset={preset}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={togglePreset}
            />
          ))}
        </div>
      )}

      {/* Count */}
      {!loading && presets.length > 0 && (
        <p className="text-xs text-gray-500 text-right">
          {presets.length} preset{presets.length !== 1 ? "s" : ""} found
        </p>
      )}
    </div>
  );
};

export default PresetGrid;