import { useState } from "react";
import Avatar from "../common/Avatar";
import api from "../../api/axios";
import { logger } from "../../utils/logger";
import Loader from "../../utils/Loader";
import { Camera, X, Pencil, Check, Mail, User } from "lucide-react";
import { useAuth } from "../../context/authContext";

const Profile = ({ user, onClose }) => {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fName: user?.fName || "",
    lName: user?.lName || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
  });

  const { refreshUser } = useAuth();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        avatar: URL.createObjectURL(file),
        avatarFile: file,
      }));
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const data = new FormData();
      data.append("fName", formData.fName);
      data.append("lName", formData.lName);
      if (formData.avatarFile) data.append("avatar", formData.avatarFile);

      const res = await api.patch("/users/update-me", data);
      await refreshUser();
      setFormData({ ...res.data.user, avatarFile: null });
      setEditMode(false);
    } catch (error) {
      logger("Profile update error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md mx-2">
      <div className="relative w-[400px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-white dark:bg-slate-900">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />

        {/* Banner */}
        <div className="h-24 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent dark:from-emerald-500/10" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute cursor-pointer top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Avatar */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2">
          <div className="relative group w-[80px] h-[80px] rounded-full ring-4 ring-white dark:ring-slate-900 overflow-hidden shadow-lg">
            <Avatar user={formData} size={80} IsInside />

            {editMode && (
              <>
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-12 flex flex-col items-center">
          {/* Name display */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            {formData.fName} {formData.lName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {formData.email}
          </p>

          {/* Fields */}
          <div className="w-full space-y-3">
            <Field
              icon={<User size={14} />}
              label="First Name"
              name="fName"
              value={formData.fName}
              onChange={handleChange}
              disabled={!editMode}
            />
            <Field
              icon={<User size={14} />}
              label="Last Name"
              name="lName"
              value={formData.lName}
              onChange={handleChange}
              disabled={!editMode}
            />
            <Field
              icon={<Mail size={14} />}
              label="Email"
              name="email"
              value={formData.email}
              disabled
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6 w-full">
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex-1 flex cursor-pointer items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors shadow-md shadow-emerald-500/20"
              >
                <Pencil size={14} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 cursor-pointer py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 cursor-pointer relative flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-md shadow-emerald-500/20"
                >
                  {loading ? (
                    <Loader className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  ) : (
                    <>
                      <Check size={14} />
                      Save
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ icon, label, name, value, onChange, disabled }) => (
  <div className="relative">
    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block pl-1">
      {label}
    </label>
    <div className="relative flex items-center">
      <span className="absolute left-3 text-gray-400 dark:text-gray-500">
        {icon}
      </span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
      />
    </div>
  </div>
);

export default Profile;
