import { FiUser, FiMoon, FiLogOut } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const Menus = ({ setShowProfile }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };
  return (
    <div className="absolute right-0 top-10 bg-white shadow-lg rounded-lg w-44 py-2">
      <button
        onClick={() => setShowProfile(true)}
        className="text-sm flex items-center gap-3 w-full px-4 py-2 cursor-pointer hover:bg-gray-100"
      >
        <FiUser size={18} />
        Profile
      </button>

      <button className=" text-sm flex items-center gap-3 w-full px-4 py-2 cursor-pointer hover:bg-gray-100">
        <FiMoon size={18} />
        Choose Theme
      </button>

      <button
        onClick={handleLogout}
        className="text-sm flex items-center gap-3 w-full px-4 py-2 cursor-pointer hover:bg-gray-100 text-red-500"
      >
        <FiLogOut size={18} />
        Logout
      </button>
    </div>
  );
};

export default Menus;
