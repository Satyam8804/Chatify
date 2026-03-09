import { useState } from "react";
import Avatar from "../common/Avatar";
import api from "../../api/axios";
import { logger } from "../../utils/logger";
import Loader from "../../utils/Loader";
import { FiCamera } from "react-icons/fi";
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
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      const preview = URL.createObjectURL(file);

      setFormData((prev) => ({
        ...prev,
        avatar: preview, // preview for UI
        avatarFile: file, // actual file for upload
      }));
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const data = new FormData();

      data.append("fName", formData.fName);
      data.append("lName", formData.lName);

      if (formData.avatarFile) {
        data.append("avatar", formData.avatarFile);
      }

      const res = await api.patch("/users/update-me", data);
      await refreshUser();

      setFormData({
        ...res.data.user,
        avatarFile: null,
      });
      setEditMode(false);
    } catch (error) {
      logger("Profile update error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      {" "}
      <div className="bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-gray-200 rounded-xl shadow-xl w-[380px] p-6 relative border border-gray-200 dark:border-gray-700">
        {" "}
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute h-8 w-8 flex justify-center items-center rotate-45 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer font-bold text-3xl right-3 top-3 text-gray-500 dark:text-gray-300 hover:text-black dark:hover:text-white"
        >
          +
        </button>
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer w-[90px] h-[90px] rounded-full overflow-hidden">
            <Avatar user={formData} size={90} IsInside />

            {editMode && (
              <>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <span className="text-white text-2xl">
                    <FiCamera className="text-white text-2xl" />
                  </span>
                </div>

                {/* Hidden file input */}
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
        {/* Details */}
        <div className="mt-6 space-y-4">
          <Input
            label="First Name"
            name="fName"
            value={formData.fName}
            onChange={handleChange}
            disabled={!editMode}
          />

          <Input
            label="Last Name"
            name="lName"
            value={formData.lName}
            onChange={handleChange}
            disabled={!editMode}
          />

          <Input label="Email" name="email" value={formData.email} disabled />
        </div>
        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="bg-blue-600 hover:bg-blue-500 cursor-pointer text-white px-4 py-2 rounded-lg"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="bg-gray-200 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer px-4 py-2 rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="w-20 rounded h-10 cursor-pointer border-none bg-green-700 text-white hover:bg-green-600 disabled:opacity-50 relative"
              >
                {loading ? (
                  <Loader className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                ) : (
                  "Save"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, name, value, onChange, disabled }) => (
  <div>
    <label className="text-sm text-gray-600 dark:text-gray-400">{label}</label>

    <input
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-gray-200 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

export default Profile;
