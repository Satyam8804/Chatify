import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import ChatSection from "./ChatSection";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import NewDirectChatModal from "./NewDirectChatModal";
import NewGroupChatModal from "./NewGroupChatModal";
import { logger } from "../../utils/logger";
import { MoreVertical, MessageSquare, Phone } from "lucide-react";
import Menus from "../Menus";

import Profile from "../profile/Profile";
import ChatifyLogo from "../../assets/logo.png";
import ThemeModal from "../common/ThemeModal";
import CallsTab from "../call/CallsTab.jsx";

const Sidebar = ({
  selectedChat,
  setSelectedChat,
  chats,
  setChats,
  onStartCall,
}) => {
  const { user } = useAuth();
  const { onlineUser, unreadCounts, socket } = useSocket();

  const [activeTab, setActiveTab] = useState("chats");
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showMenus, setShowMenus] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [ongoingCall, setOngoingCall] = useState(null);

  const [callLogs, setCallLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastSeenCallTime, setLastSeenCallTime] = useState(null);

  const menuRef = useRef(null);
  const joinedChatsRef = useRef(new Set());
  const LIMIT = 20;

  const fetchAllChats = async () => {
    try {
      const res = await api.get("/chats");
      setChats(res?.data || []);
    } catch (error) {
      logger(error.message);
    }
  };

  const fetchCalls = async (pageNumber = 1, force = false) => {
    if (!force && (loading || (pageNumber !== 1 && !hasMore))) return;

    setLoading(true);

    try {
      const res = await api.get(
        `/messages/calls/logs?page=${pageNumber}&limit=${LIMIT}`
      );

      const { logs: newLogs = [], hasMore: moreAvailable = false } =
        res?.data || {};

      setHasMore(moreAvailable);

      setCallLogs((prev) => {
        if (pageNumber === 1) return newLogs;

        const existingIds = new Set(prev.map((c) => c._id));
        const filtered = newLogs.filter((c) => !existingIds.has(c._id));

        return [...prev, ...filtered];
      });
    } catch (err) {
      console.error("Failed to fetch calls", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextPage = () => {
    if (loading || !hasMore) return;

    setPage((prev) => {
      const next = prev + 1;
      fetchCalls(next);
      return next;
    });
  };

  const missedCount = callLogs.filter(
    (c) =>
      c.status === "missed" &&
      (!lastSeenCallTime || new Date(c.createdAt) > lastSeenCallTime)
  ).length;

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    if (tab === "calls") {
      setLastSeenCallTime(new Date());
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
    if (activeTab === "calls") {
      setPage(1);
      fetchCalls(1, true);
    }
  }, [activeTab]);

  useEffect(() => {
    joinedChatsRef.current = new Set();
  }, [socket]);

  useEffect(() => {
    if (!socket || !chats.length) return;
    chats.forEach((chat) => {
      if (!joinedChatsRef.current.has(chat._id)) {
        socket.emit("join-chat", chat._id);
        joinedChatsRef.current.add(chat._id);
      }
    });
  }, [socket, chats]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (newMessage) => {
      updateChatLatestMessage(newMessage);
    };

    const handleCallLog = (message) => {
      setPage(1);
      fetchCalls(1, true);
      if (message) {
        updateChatLatestMessage(message);
      }
    };

    const handleNewChat = (newChat) => {
      setChats((prev) => {
        const exists = prev.find((c) => c._id === newChat._id);
        if (exists) return prev;
        return [newChat, ...prev];
      });
      socket.emit("join-chat", newChat._id);
      joinedChatsRef.current.add(newChat._id);
    };

    const handleOngoingCall = (data) => {
      console.log("📞 Ongoing call (sidebar):", data);
      setOngoingCall(data);
    };

    const handleCallEnded = () => {
      console.log("📴 Clearing ongoing call");
      setOngoingCall(null);
    };

    socket.on("call-ended", handleCallEnded);
    socket.on("ongoing-call", handleOngoingCall);

    socket.on("receive-message", handleMessage);
    socket.on("call-log-saved", handleCallLog);
    socket.on("new-chat-created", handleNewChat);

    return () => {
      socket.off("receive-message", handleMessage);
      socket.off("call-log-saved", handleCallLog);
      socket.off("new-chat-created", handleNewChat);
      socket.off("ongoing-call", handleOngoingCall);
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowMenus(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const directChats = chats.filter((chat) => !chat.isGroupChat);
  const groupChats = chats.filter((chat) => chat.isGroupChat);

  console.log("🧠 Sidebar state ongoingCall:", ongoingCall);

  return (
    <div className="relative h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 transition-colors">
      <div className="flex justify-between items-center px-5 py-4 border-b-2 border-gray-300 dark:border-slate-500 inset">
        <div className="flex items-center gap-2">
          <img src={ChatifyLogo} alt="" className="h-12" />
          <span className="text-3xl font-extrabold text-gray-500 dark:text-gray-200">
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

      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === "chats" ? (
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
        ) : (
          <CallsTab
            onStartCall={onStartCall}
            chats={chats}
            callLogs={callLogs}
            loading={loading}
            fetchNextPage={fetchNextPage}
            hasMore={hasMore}
            ongoingCall={ongoingCall}
          />
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-slate-700 flex shrink-0">
        <button
          onClick={() => handleTabChange("chats")}
          className={`flex-1 flex flex-col cursor-pointer items-center justify-center py-2 text-[11px] font-medium transition-colors ${
            activeTab === "chats"
              ? "text-emerald-500"
              : "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <MessageSquare size={18} />
          <span className="mt-0.5">Chats</span>
          {activeTab === "chats" && (
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          onClick={() => handleTabChange("calls")}
          className={`relative flex-1 flex flex-col cursor-pointer items-center justify-center py-2 text-[11px] font-medium transition-colors ${
            activeTab === "calls"
              ? "text-emerald-500"
              : "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <div className="relative">
            <Phone size={18} />
            {missedCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 text-[9px] bg-rose-500 text-white min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {missedCount}
              </span>
            )}
          </div>
          <span className="mt-0.5">Calls</span>
          {activeTab === "calls" && (
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>
      </div>

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

      {showMenus && (
        <div ref={menuRef}>
          <Menus
            setShowProfile={setShowProfile}
            setShowThemeModal={setShowThemeModal}
          />
        </div>
      )}
      {showProfile && (
        <Profile onClose={() => setShowProfile(false)} user={user} />
      )}
      {showThemeModal && (
        <ThemeModal onClose={() => setShowThemeModal(false)} />
      )}
    </div>
  );
};

export default Sidebar;
