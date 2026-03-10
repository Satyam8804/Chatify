import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import ChatSection from "./ChatSection";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import NewDirectChatModal from "./NewDirectChatModal";
import NewGroupChatModal from "./NewGroupChatModal";
import { logger } from "../../utils/logger";
import { MoreVertical } from "lucide-react";
import Menus from "../Menus";
import Loader from "../../utils/Loader";
import Profile from "../profile/Profile";
import ChatifyLogo from "../../assets/logo.png";
import ThemeModal from "../common/ThemeModal";

const Sidebar = ({ selectedChat, setSelectedChat }) => {
  const { loading, user } = useAuth();
  const { onlineUser, unreadCounts, socket } = useSocket();
  console.log(user)
  console.log(onlineUser)
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [chats, setChats] = useState([]);

  const [showMenus, setShowMenus] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const menuRef = useRef(null);

  const fetchAllChats = async () => {
    try {
      const res = await api.get("/chats");
      setChats(res?.data || []);
    } catch (error) {
      logger(error.message);
    }
  };

  const updateChatLatestMessage = (newMessage) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) =>
        chat._id === newMessage.chat._id
          ? { ...chat, lastMessage: newMessage }
          : chat
      );

      const chatIndex = updatedChats.findIndex(
        (chat) => chat._id === newMessage.chat._id
      );

      if (chatIndex > -1) {
        const [updatedChat] = updatedChats.splice(chatIndex, 1);
        updatedChats.unshift(updatedChat);
      }

      return updatedChats;
    });
  };

  useEffect(() => {
    if (!user?._id) {
      setChats([]);
      return;
    }
    fetchAllChats();
  }, [user?._id]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (newMessage) => {
      updateChatLatestMessage(newMessage);
    };

    socket.on("message-received", handleMessage);

    return () => {
      socket.off("message-received", handleMessage);
    };
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenus(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return <Loader />;
  }

  const directChats = chats.filter((chat) => !chat.isGroupChat);
  const groupChats = chats.filter((chat) => chat.isGroupChat);

  return (
    <div className="relative h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <img src={ChatifyLogo} alt="" className="h-12" /> {/* icon only SVG */}
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Chatify
          </span>
        </div>

        <button
          onClick={() => setShowMenus(!showMenus)}
          className="w-8 h-8 cursor-pointer flex justify-center items-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Chat Lists */}
      <div className="flex-1 flex flex-col px-3 gap-4 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
          <ChatSection
            title="DIRECT MESSAGES"
            unreadCounts={unreadCounts}
            chats={directChats}
            selectedChat={selectedChat}
            onlineUser={onlineUser}
            setSelectedChat={setSelectedChat}
            onAddClick={() => setShowDirectModal(true)}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
          <ChatSection
            title="GROUP CHATS"
            unreadCounts={unreadCounts}
            chats={groupChats}
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            onAddClick={() => setShowGroupModal(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <div className="z-50">
        {showDirectModal && (
          <NewDirectChatModal
            onClose={() => setShowDirectModal(false)}
            setSelectedChat={setSelectedChat}
          />
        )}

        {showGroupModal && (
          <NewGroupChatModal
            onClose={() => setShowGroupModal(false)}
            setSelectedChat={setSelectedChat}
          />
        )}
      </div>

      {/* Menu */}
      {showMenus && (
        <div ref={menuRef}>
          <Menus
            setShowProfile={setShowProfile}
            setShowThemeModal={setShowThemeModal}
          />
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <Profile onClose={() => setShowProfile(false)} user={user} />
      )}

      {/* Theme Modal */}
      {showThemeModal && (
        <ThemeModal onClose={() => setShowThemeModal(false)} />
      )}
    </div>
  );
};

export default Sidebar;
