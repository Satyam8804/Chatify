import { memo, useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import ChatSection from "./ChatSection";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import NewDirectChatModal from "./NewDirectChatModal";
import NewGroupChatModal from "./NewGroupChatModal";
import { logger } from "../../utils/logger";
import {
  MoreVertical,
  MessageSquareText,
  Phone,
  Search, // ← add
  X,
} from "lucide-react";
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
  onJoinCall,
}) => {
  const { user, setUser, refreshUser } = useAuth();

  const { onlineUser, unreadCounts, socket } = useSocket();

  const [activeTab, setActiveTab] = useState("chats");
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showMenus, setShowMenus] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [ongoingCall, setOngoingCall] = useState(null);
  // 1. Add a ref for the button
  const menuButtonRef = useRef(null);

  const [callLogs, setCallLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastSeenCallTime, setLastSeenCallTime] = useState(null);
  const [chatFilter, setChatFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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
    if (tab === "calls") setLastSeenCallTime(new Date());
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
  }, [user?._id]);

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

    const handleMessage = (newMessage) => updateChatLatestMessage(newMessage);
    const handleCallLog = (message) => {
      setPage(1);
      fetchCalls(1, true);
      if (message) updateChatLatestMessage(message);
    };
    const handleNewChat = (newChat) => {
      setChats((prev) => {
        if (prev.find((c) => c._id === newChat._id)) return prev;
        return [newChat, ...prev];
      });
      socket.emit("join-chat", newChat._id);
      joinedChatsRef.current.add(newChat._id);
    };
    const handleOngoingCall = (data) =>
      setOngoingCall((prev) => (prev?.chatId === data.chatId ? prev : data));
    const handleEnd = ({ chatId }) =>
      setOngoingCall((prev) =>
        String(prev?.chatId) === String(chatId) ? null : prev
      );

    const handleChatDeleted = ({ chatId }) => {
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      if (selectedChat?._id === chatId) setSelectedChat(null);
    };

    const handleMessageSeen = ({ chatId, userId }) => {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat._id !== chatId) return chat;
          if (!chat.lastMessage) return chat;

          const alreadySeen = chat.lastMessage.readBy?.includes(userId);
          if (alreadySeen) return chat;

          return {
            ...chat,
            lastMessage: {
              ...chat.lastMessage,
              readBy: [...(chat.lastMessage.readBy || []), userId],
            },
          };
        })
      );
    };

    const handleBlockStatusChanged = ({ byUserId, isBlocked }) => {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.isGroupChat) return chat;

          // find the chat that contains this user
          const isRelevant = chat.users.some(
            (u) => u._id?.toString() === byUserId
          );
          if (!isRelevant) return chat;

          return {
            ...chat,
            users: chat.users.map((u) =>
              u._id?.toString() === byUserId
                ? {
                    ...u,
                    blockedUsers: isBlocked
                      ? [...(u.blockedUsers || []), user._id.toString()]
                      : (u.blockedUsers || []).filter(
                          (id) => id.toString() !== user._id.toString()
                        ),
                  }
                : u
            ),
          };
        })
      );
    };

    socket.on("block-status-changed", handleBlockStatusChanged);
    socket.on("message-seen", handleMessageSeen);
    socket.on("chat-deleted", handleChatDeleted);
    socket.on("call-ended", handleEnd);
    socket.on("call-fully-ended", handleEnd);
    socket.on("ongoing-call", handleOngoingCall);
    socket.on("receive-message", handleMessage);
    socket.on("call-log-saved", handleCallLog);
    socket.on("new-chat-created", handleNewChat);

    return () => {
      socket.off("receive-message", handleMessage);
      socket.off("call-log-saved", handleCallLog);
      socket.off("new-chat-created", handleNewChat);
      socket.off("ongoing-call", handleOngoingCall);
      socket.off("call-fully-ended", handleEnd);
      socket.off("call-ended", handleEnd);
      socket.off("chat-deleted", handleChatDeleted);
      socket.off("message-seen", handleMessageSeen);
      socket.off("block-status-changed", handleBlockStatusChanged);
    };
  }, [socket]);

  useEffect(() => {
    // 3. Update the outside-click handler
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        menuButtonRef.current && // ← add this
        !menuButtonRef.current.contains(e.target) // ← and this
      ) {
        setShowMenus(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allChats = [...chats]
    .filter((chat) => {
      if (chatFilter === "direct") return !chat.isGroupChat;
      if (chatFilter === "groups") return chat.isGroupChat;
      if (chatFilter === "unread") return (unreadCounts?.[chat._id] || 0) > 0;
      if (chatFilter === "favourite") return chat.isFavourite;
      return true;
    })
    .sort((a, b) => {
      // 📌 Pinned always on top
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // Then sort by latest message
      const aTime = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt)
        : new Date(a.createdAt);
      const bTime = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt)
        : new Date(b.createdAt);
      return bTime - aTime;
    });

  const filteredChats = searchQuery.trim()
    ? allChats.filter((chat) => {
        const q = searchQuery.toLowerCase();
        if (chat.isGroupChat) {
          return chat.chatName?.toLowerCase().includes(q);
        }
        const otherUser = chat.users.find(
          (u) => u._id?.toString() !== user._id?.toString()
        );
        const fullName = `${otherUser?.fName || ""} ${
          otherUser?.lName || ""
        }`.toLowerCase();
        return fullName.includes(q);
      })
    : allChats;

  const filters = [
    { key: "all", label: "All" },
    { key: "direct", label: "Direct" },
    { key: "groups", label: "Groups" },
    { key: "unread", label: "Unread" },
    { key: "favourite", label: "Favourite" },
  ];

  const handleChatAction = async (action, chat) => {
    try {
      if (action === "favourite") {
        const res = await api.patch(`/chats/${chat._id}`, {
          toggle: "isFavourite",
        });
        setChats((prev) =>
          prev.map((c) => (c._id === chat._id ? res.data : c))
        );
      }

      if (action === "pin") {
        const res = await api.patch(`/chats/${chat._id}`, {
          toggle: "isPinned",
        });
        setChats((prev) =>
          prev.map((c) => (c._id === chat._id ? res.data : c))
        );
      }

      if (action === "block") {
        const friend = chat.users.find((u) => u._id !== user._id);
        if (!friend) return;

        const res = await api.patch("/users/block", { userId: friend._id });
        setUser((prev) => ({ ...prev, blockedUsers: res.data.blockedUsers }));
      }

      if (action === "clear") {
        await api.delete(`/messages/clear/${chat._id}`);
        setChats((prev) =>
          prev.map((c) =>
            c._id === chat._id ? { ...c, lastMessage: null } : c
          )
        );
        if (selectedChat?._id === chat._id) setSelectedChat(null);
      }

      if (action === "delete") {
        await api.delete(`/chats/${chat._id}`);
        setChats((prev) => prev.filter((c) => c._id !== chat._id));
        if (selectedChat?._id === chat._id) setSelectedChat(null);
      }
    } catch (err) {
      console.error(`Chat action "${action}" failed:`, err);
    }
  };

  return (
    <div className="relative h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 transition-colors overflow-visible">
      <div className="flex justify-between items-center px-5 py-4 ">
        <div className="flex items-center gap-2">
          <img src={ChatifyLogo} alt="" className="h-12" />
          <span className="text-3xl font-extrabold text-gray-500 dark:text-gray-200">
            Chatify
          </span>
        </div>
        <div className="relative" ref={menuButtonRef}>
          <button
            onClick={() => setShowMenus(!showMenus)}
            className="w-8 h-8 cursor-pointer flex justify-center items-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <MoreVertical size={20} />
          </button>

          {showMenus && (
            <div ref={menuRef}>
              <Menus
                setShowProfile={setShowProfile}
                setShowThemeModal={setShowThemeModal}
                setShowDirectModal={setShowDirectModal}
                setShowGroupModal={setShowGroupModal}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === "chats" ? (
          <div className="flex-1 flex flex-col px-3 min-h-0">
            {/* Search bar */}
            <div className="relative mx-2 mb-3">
              <Search
                size={18}
                className="absolute  left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-8 pr-7 py-3 text-[14px] font-bold rounded-3xl bg-gray-100 dark:bg-slate-800/70 text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-600 border border-transparent focus:border-emerald-400/40 dark:focus:border-emerald-600/40 focus:outline-none focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300 dark:bg-slate-600 flex items-center justify-center hover:bg-gray-400 dark:hover:bg-slate-500 transition-colors"
                >
                  <X size={9} className="text-gray-600 dark:text-slate-300" />
                </button>
              )}
            </div>
            {/* Section header */}
            <div className="flex justify-between items-center px-2 pt-1 pb-2">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Messages
              </h3>
            </div>

            {/* 👇 Capsule filters */}
            <div className="flex gap-1.5 px-2 pb-2 overflow-x-auto hide-scrollbar">
              {filters.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setChatFilter(key)}
                  className={`shrink-0 px-4 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer
        ${
          chatFilter === key
            ? "bg-emerald-500 text-white shadow-sm"
            : "border-gray-200 border-2 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-200 dark:hover:bg-slate-700"
        }`}
                >
                  {label}
                  {/* Show unread count on the Unread pill */}
                  {key === "unread" &&
                    (() => {
                      const count = chats.filter(
                        (c) => (unreadCounts?.[c._id] || 0) > 0
                      ).length;
                      return count > 0 ? (
                        <span
                          className={`ml-1 ${
                            chatFilter === "unread"
                              ? "text-white/80"
                              : "text-emerald-500"
                          }`}
                        >
                          {count}
                        </span>
                      ) : null;
                    })()}
                </button>
              ))}
            </div>

            {/* Merged chat list */}
            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
              {filteredChats.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 dark:text-slate-600">
                  {searchQuery
                    ? `No chats matching "${searchQuery}"`
                    : "No conversations yet. Start chatting!"}
                </p>
              ) : (
                <div className="space-y-0.5 pb-4">
                  {filteredChats.map((chat) => (
                    <ChatSection
                      key={chat._id}
                      chat={chat}
                      onlineUser={onlineUser}
                      isActive={selectedChat?._id === chat._id}
                      onClick={() => setSelectedChat(chat)}
                      unreadCounts={unreadCounts}
                      onChatAction={handleChatAction}
                    />
                  ))}
                </div>
              )}
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
            onJoinCall={onJoinCall}
          />
        )}
      </div>

      {/* ── Bottom tabs ── */}
      <div className="border-t py-1 rounded-2xl border-gray-100 dark:border-slate-800 flex shrink-0">
        <button
          onClick={() => handleTabChange("chats")}
          className={`flex-1 flex flex-col cursor-pointer items-center justify-center py-2 text-[11px] font-medium transition-colors ${
            activeTab === "chats"
              ? "text-emerald-500"
              : "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <MessageSquareText size={20} />
          <span
            className={`mt-0.5 text-[14px] ${
              activeTab == "chats" ? `font-bold` : ``
            } `}
          >
            Chats
          </span>
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
            <Phone size={20} />
            {missedCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 text-[9px] bg-rose-500 text-white min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {missedCount}
              </span>
            )}
          </div>
          <span
            className={`mt-0.5 text-[14px] ${
              activeTab == "calls" ? `font-bold` : ``
            } `}
          >
            Calls
          </span>
          {ongoingCall && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
          {activeTab === "calls" && !ongoingCall && (
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>
      </div>

      {/* ── Modals ── */}
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
      {showProfile && (
        <Profile onClose={() => setShowProfile(false)} user={user} />
      )}
      {showThemeModal && (
        <ThemeModal onClose={() => setShowThemeModal(false)} />
      )}
    </div>
  );
};

export default memo(Sidebar);
