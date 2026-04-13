import { useState, useRef, useEffect } from "react";
import { X, UploadCloud } from "lucide-react";
import { useBackground } from "../../context/backgoundContext.jsx";

const CATEGORIES = ["Nature", "Abstract", "Minimal", "Dark", "Light", "Other"];
const TYPES = ["image", "gradient", "solid_color"];

const defaultForm = {
  name: "",
  category: "Other",
  type: "image",
  tags: "",
  sortOrder: 0,
};

const UploadBackgroundModal = ({ open, onClose, editingPreset }) => {
  const { addPreset, editPreset, uploading } = useBackground();

  const [form, setForm] = useState(defaultForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editingPreset) {
      setForm({
        name: editingPreset.name,
        category: editingPreset.category,
        type: editingPreset.type,
        tags: editingPreset.tags?.join(", ") || "",
        sortOrder: editingPreset.sortOrder || 0,
      });
      setPreview(editingPreset.thumbnailUrl);
      setImageFile(null);
    } else {
      setForm(defaultForm);
      setPreview(null);
      setImageFile(null);
    }
  }, [editingPreset, open]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!editingPreset && !imageFile) return;

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("category", form.category);
    formData.append("type", form.type);
    formData.append("tags", JSON.stringify(
      form.tags.split(",").map((t) => t.trim()).filter(Boolean)
    ));
    formData.append("sortOrder", form.sortOrder);
    if (imageFile) formData.append("image", imageFile);

    const success = editingPreset
      ? await editPreset(editingPreset._id, formData)
      : await addPreset(formData);

    if (success) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg shadow-xl border border-white/10">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-lg">
            {editingPreset ? "Edit Preset" : "Upload Preset"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Image upload */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full h-48 rounded-xl border-2 border-dashed border-white/20 hover:border-indigo-500 transition cursor-pointer overflow-hidden flex items-center justify-center bg-gray-800"
          >
            {preview ? (
              <>
                <img
                  src={preview}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <p className="text-white text-sm">Click to replace</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <UploadCloud size={32} />
                <p className="text-sm">Drag & drop or click to upload</p>
                <p className="text-xs">JPG, PNG, WEBP</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ocean Breeze"
              className="w-full bg-gray-800 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Category + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-gray-800 border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-gray-800 border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Tags <span className="text-gray-600">(comma separated)</span>
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="e.g. blue, calm, nature"
              className="w-full bg-gray-800 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Sort order */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white transition px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || (!editingPreset && !imageFile) || !form.name}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition"
          >
            {uploading ? "Uploading..." : editingPreset ? "Save Changes" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadBackgroundModal;