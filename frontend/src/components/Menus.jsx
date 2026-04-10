import { User, Moon, LogOut, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const Menus = ({
  setShowProfile,
  setShowThemeModal,
  setShowDirectModal,
  setShowGroupModal,
}) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="animate-menu absolute right-2 top-12 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl w-48 py-2 overflow-hidden">
      <button
        onClick={() => setShowDirectModal(true)}
        className="menu-item text-sm flex items-center gap-3 w-full px-4 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors"
      >
        <UserPlus size={16} />
        New Direct Chat
      </button>

      <button
        onClick={() => setShowGroupModal(true)}
        className="menu-item text-sm flex items-center gap-3 w-full px-4 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors"
      >
        <Users size={16} />
        New Group Chat
      </button>

      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

      <button
        onClick={() => setShowProfile(true)}
        className="menu-item text-sm flex items-center gap-3 w-full px-4 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors"
      >
        <User size={16} />
        Profile
      </button>

      <button
        onClick={() => setShowThemeModal(true)}
        className="menu-item text-sm flex items-center gap-3 w-full px-4 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors"
      >
        <Moon size={16} />
        Choose Theme
      </button>

      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

      <button
        onClick={handleLogout}
        className="menu-item text-sm flex items-center gap-3 w-full px-4 py-2.5 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  );
};

export default Menus;
