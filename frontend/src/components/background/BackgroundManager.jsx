import { useState } from "react";
import { Plus } from "lucide-react";

import PresetGrid from "./PresetGrid.jsx";
import UploadBackgroundModal from "./UploadBackgroundModal.jsx";
import DeleteConfirmModal from "./DeleteConfirmModal.jsx";

const BackgroundManager = () => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [deletingPreset, setDeletingPreset] = useState(null);

  const handleEdit = (preset) => {
    setEditingPreset(preset);
    setUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setUploadModalOpen(false);
    setEditingPreset(null);
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-semibold">Backgrounds</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage preset backgrounds available to users
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2.5 rounded-lg transition"
        >
          <Plus size={16} />
          Add Preset
        </button>
      </div>

      {/* Grid */}
      <PresetGrid
        onEdit={handleEdit}
        onDelete={(preset) => setDeletingPreset(preset)}
      />

      {/* Upload / Edit Modal */}
      <UploadBackgroundModal
        open={uploadModalOpen}
        onClose={handleCloseUploadModal}
        editingPreset={editingPreset}
      />

      {/* Delete Modal */}
      <DeleteConfirmModal
        open={!!deletingPreset}
        onClose={() => setDeletingPreset(null)}
        preset={deletingPreset}
      />
    </div>
  );
};

export default BackgroundManager;