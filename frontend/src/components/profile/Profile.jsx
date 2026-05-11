import { useState } from "react";
import Avatar from "../common/Avatar";
import api from "../../api/axios";
import { logger } from "../../utils/logger";
import Loader from "../../utils/Loader";
import SetPasswordModal from "../../auth/SetPasswordModal.jsx";
import {
  Camera,
  X,
  Pencil,
  Check,
  Mail,
  User,
  Lock,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/authContext";

const Profile = ({ user, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null); // 'fName' | 'lName' | null
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    fName: user?.fName || "",
    lName: user?.lName || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
  });

  const { refreshUser } = useAuth();

  const isGoogleUser = user?.provider === "google" || !user?.password;

  // ── Handlers ─────────────────────────────────────────────────────

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFormData((prev) => ({
      ...prev,
      avatar: URL.createObjectURL(file),
      avatarFile: file,
    }));
    handleSaveField(null, file);
  };

  const handleSaveField = async (field, avatarFile) => {
    try {
      setLoading(true);
      const data = new FormData();
      data.append("fName", formData.fName);
      data.append("lName", formData.lName);
      if (avatarFile) data.append("avatar", avatarFile);
      await api.patch("/users/update-me", data);
      await refreshUser();
      setEditingField(null);
    } catch (error) {
      logger("Profile update error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelField = (field) => {
    setEditingField(null);
    setFormData((prev) => ({ ...prev, [field]: user?.[field] || "" }));
  };

  const handlePasswordSuccess = async () => {
    setShowPasswordModal(false);
    await refreshUser();
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
        <div className="relative w-[95vw] sm:w-[400px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-white dark:bg-slate-900">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              Profile
            </span>
            {editingField ? (
              <button
                onClick={() => handleSaveField(editingField)}
                disabled={loading}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader size={12} /> : <Check size={14} />}
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto max-h-[80vh]">
            {/* Avatar */}
            <div className="flex flex-col items-center pt-5 pb-4 border-b border-gray-100 dark:border-slate-800">
              <div className="relative group w-[72px] h-[72px] rounded-full ring-4 ring-emerald-500/30 overflow-hidden shadow-lg mb-3">
                <Avatar user={formData} size={72} IsInside />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera size={18} className="text-white" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {formData.fName} {formData.lName}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {formData.email}
              </p>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Account section */}
              <Section label="Account">
                <FieldRow
                  icon={<User size={15} />}
                  label="First name"
                  name="fName"
                  value={formData.fName}
                  isEditing={editingField === "fName"}
                  onEdit={() => setEditingField("fName")}
                  onCancel={() => handleCancelField("fName")}
                  onChange={handleChange}
                  loading={loading && editingField === "fName"}
                  onSave={() => handleSaveField("fName")}
                />
                <FieldRow
                  icon={<User size={15} />}
                  label="Last name"
                  name="lName"
                  value={formData.lName}
                  isEditing={editingField === "lName"}
                  onEdit={() => setEditingField("lName")}
                  onCancel={() => handleCancelField("lName")}
                  onChange={handleChange}
                  loading={loading && editingField === "lName"}
                  onSave={() => handleSaveField("lName")}
                />
                {/* Email — readonly */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-emerald-500 shrink-0">
                    <Mail size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                      Email
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 truncate">
                      {formData.email}
                    </p>
                  </div>
                  {isGoogleUser && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full shrink-0">
                      Google
                    </span>
                  )}
                </div>
              </Section>

              {/* Security section */}
              <Section label="Security">
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer rounded-b-xl"
                >
                  <span className="text-emerald-500 shrink-0">
                    <Lock size={15} />
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-sm text-gray-800 dark:text-gray-100">
                      {user?.hasPassword ? "Change password" : "Set password"}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {user?.hasPassword
                        ? "Update your login password"
                        : "Enable email login alongside Google"}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-gray-400 shrink-0" />
                </button>
              </Section>
            </div>
          </div>
        </div>
      </div>

      {/* SetPasswordModal — mounted outside the profile card */}
      <SetPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userEmail={formData.email}
        hasPassword={user?.hasPassword} // ← add
        onSuccess={handlePasswordSuccess}
      />
    </>
  );
};

// ── Section wrapper ───────────────────────────────────────────────

const Section = ({ label, children }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 pl-1">
      {label}
    </p>
    <div className="rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden divide-y divide-gray-100 dark:divide-slate-800 bg-gray-50 dark:bg-slate-800/40">
      {children}
    </div>
  </div>
);

// ── Inline-editable field row ─────────────────────────────────────

const FieldRow = ({
  icon,
  label,
  name,
  value,
  isEditing,
  onEdit,
  onCancel,
  onChange,
  loading,
  onSave,
}) => (
  <div className="flex items-center gap-3 px-3 py-2.5">
    <span className="text-emerald-500 shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
        {label}
      </p>
      {isEditing ? (
        <input
          name={name}
          value={value}
          onChange={onChange}
          autoFocus
          className="w-full text-sm bg-transparent border-b border-emerald-500 text-gray-800 dark:text-gray-100 focus:outline-none pb-0.5"
        />
      ) : (
        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
          {value}
        </p>
      )}
    </div>
    {isEditing ? (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500 transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
        <button
          onClick={onSave}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader size={10} /> : <Check size={13} />}
        </button>
      </div>
    ) : (
      <button
        onClick={onEdit}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
      >
        <Pencil size={13} />
      </button>
    )}
  </div>
);

export default Profile;
