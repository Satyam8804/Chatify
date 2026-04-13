import { Trash2 } from "lucide-react";
import { useBackground } from "../../context/backgoundContext.jsx";

const DeleteConfirmModal = ({ open, onClose, preset }) => {
  const { removePreset } = useBackground();

  const handleDelete = async () => {
    const success = await removePreset(preset._id);
    if (success) onClose();
  };

  if (!open || !preset) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl border border-white/10">

        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <h2 className="text-white font-semibold text-lg">Delete Preset</h2>
          <p className="text-gray-400 text-sm mt-2">
            Are you sure you want to delete{" "}
            <span className="text-white font-medium">"{preset.name}"</span>?
            This action cannot be undone.
          </p>
        </div>

        {/* Preview */}
        <div className="px-6 pb-4">
          <img
            src={preset.thumbnailUrl}
            alt={preset.name}
            className="w-full h-32 object-cover rounded-xl opacity-60"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2.5 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;