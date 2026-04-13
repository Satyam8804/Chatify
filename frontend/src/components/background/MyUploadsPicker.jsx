import { useEffect, useRef, useState } from "react";
import { Check, Trash2, UploadCloud, Loader } from "lucide-react";
// import { useBackground } from "../../context/backgoundContext.jsx";
import {
  uploadCustomBackground,
  deleteCustomBackground,
  getMyUploadedBackgrounds,
} from "../../api/background.api.js";

const MyUploadsPicker = ({ selected, onSelect }) => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [imageLoaded, setImageLoaded] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    setLoading(true);
    try {
      const { data } = await getMyUploadedBackgrounds();
      setUploads(data);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setUploading(true);
    try {
      const { data } = await uploadCustomBackground(formData);
      setUploads((prev) => [data, ...prev]);
      onSelect({
        backgroundType: "UserBackground",
        backgroundRef: data._id,
        previewUrl: data.assetUrl,
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteCustomBackground(id);
      setUploads((prev) => prev.filter((u) => u._id !== id));
      if (selected?.backgroundRef === id) onSelect(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelect = (upload) => {
    onSelect({
      backgroundType: "UserBackground",
      backgroundRef: upload._id,
      previewUrl: upload.assetUrl,
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-full h-36 rounded-xl animate-pulse bg-gray-200 dark:bg-slate-700"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full h-14 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-gray-400 dark:text-slate-500 hover:text-emerald-500 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <Loader size={16} className="animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <UploadCloud size={16} />
            Upload from Gallery
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {/* Empty state */}
      {uploads.length === 0 && !uploading && (
        <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-slate-500 gap-2">
          <UploadCloud size={28} />
          <p className="text-sm">No uploads yet</p>
          <p className="text-xs">Upload an image from your gallery</p>
        </div>
      )}

      {/* Grid */}
      {uploads.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {uploads.map((upload) => {
            const isSelected = selected?.backgroundRef === upload._id;
            const isDeleting = deletingId === upload._id;

            return (
              <button
                key={upload._id}
                onClick={() => handleSelect(upload)}
                disabled={isDeleting}
                className={`relative w-full h-36 rounded-xl overflow-hidden border-2 transition ${
                  isSelected
                    ? "border-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "border-transparent hover:border-gray-300 dark:hover:border-slate-600"
                } disabled:opacity-50`}
              >
                {!imageLoaded[upload._id] && (
                  <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-slate-700" />
                )}
                <img
                  src={upload.thumbnailUrl}
                  alt={upload.fileName}
                  onLoad={() =>
                    setImageLoaded((prev) => ({ ...prev, [upload._id]: true }))
                  }
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    imageLoaded[upload._id] ? "opacity-100" : "opacity-0"
                  }`}
                />

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}

                {/* Delete button */}
                <div
                  onClick={(e) => handleDelete(e, upload._id)}
                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-red-500 flex items-center justify-center opacity-0 hover:opacity-100 transition cursor-pointer"
                >
                  {isDeleting ? (
                    <Loader size={12} className="text-white animate-spin" />
                  ) : (
                    <Trash2 size={12} className="text-white" />
                  )}
                </div>

                {/* File name */}
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">
                    {upload.fileName}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyUploadsPicker;
