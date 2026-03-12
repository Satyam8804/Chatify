import { useState } from "react";
import {
  X,
  UserPlus,
  UserMinus,
  Crown,
  Plus,
  UserSearch,
  ArrowRight,
  Trash2,
  Loader,
} from "lucide-react";
import Avatar from "../common/Avatar";
import { formatLastSeen } from "../../utils/formatMessageDate";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import api from "../../api/axios";
import { logger } from "../../utils/logger";
import MediaModal from "../common/MediaModal.jsx";
import ImagePreview from "../chat/ImagePreview.jsx";

const ChatInfo = ({
  chat,
  friend,
  isGroup,
  isOnline,
  onClose,
  setSelectedChat,
  messages,
  onClearChat,
}) => {
  const { onlineUser } = useSocket();
  const { user } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [groupChat, setGroupChat] = useState(chat);
  const [showAddInput, setShowAddInput] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [previewImage, setPreviewImage] = useState(undefined); // ✅ undefined = closed, null = no photo, string = url

  const isAdmin =
    groupChat?.groupAdmin?._id === user?._id ||
    groupChat?.groupAdmin === user?._id;

  const imageMessages = messages.filter((msg) => {
    const ext = msg?.media?.[0]?.name?.split(".").pop()?.toLowerCase();
    return ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  });

  const handleStartChat = async (member) => {
    if (member._id === user._id) return;
    try {
      const res = await api.post("/chats", { userId: member._id });
      setSelectedChat(res.data);
      onClose();
    } catch (error) {
      logger(error);
    }
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    try {
      setSearching(true);
      const res = await api.get(`/users/search?query=${searchEmail}`);
      const filtered = res.data.users?.filter(
        (u) => !groupChat.users.find((m) => m._id === u._id)
      );
      setSearchResult(filtered || []);
    } catch (error) {
      logger(error);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (userId) => {
    try {
      const res = await api.patch("/chats/group/add", {
        chatId: groupChat._id,
        userId,
      });
      setGroupChat(res.data?.updated);
      setSearchResult(null);
      setSearchEmail("");
      setShowAddInput(false);
    } catch (error) {
      logger(error);
    }
  };

  const handleRemove = async (userId) => {
    try {
      const res = await api.patch("/chats/group/remove", {
        chatId: groupChat._id,
        userId,
      });
      setGroupChat(res.data?.updated);
    } catch (error) {
      logger(error);
    }
  };
  const handleClearChat = async () => {
    try {
      setClearing(true); // ✅ show loader
      await api.delete(`/messages/clear/${chat._id}`);
      onClearChat();
      onClose();
    } catch (error) {
      logger(error);
    } finally {
      setClearing(false); // ✅ hide loader
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-menu overflow-hidden">
        {/* Image Preview — undefined=closed, null=no photo, string=url */}
        {previewImage !== undefined && (
          <ImagePreview
            url={previewImage}
            onClose={() => setPreviewImage(undefined)}
          />
        )}

        {/* Media Modal */}
        {showMedia && (
          <MediaModal messages={messages} onClose={() => setShowMedia(false)} />
        )}

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {isGroup ? "Group Info" : "Contact Info"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 cursor-pointer flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar border-b-1 border-gray-100 dark:border-slate-700">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center py-8 gap-3 bg-gradient-to-b from-emerald-500/5 to-transparent">
            {/* ✅ always clickable for direct chat — opens preview or no-photo screen */}
            <div
              onClick={() =>
                !isGroup && setPreviewImage(friend?.avatar || null)
              }
              className={
                !isGroup
                  ? "cursor-pointer hover:opacity-90 transition-opacity"
                  : "cursor-default"
              }
            >
              {isGroup ? (
                <Avatar
                  users={chat.users}
                  isGroup={true}
                  size={90}
                  IsInside={true}
                />
              ) : (
                <Avatar
                  user={friend}
                  isOnline={isOnline}
                  size={90}
                  IsInside={true}
                />
              )}
            </div>

            <div className="text-center w-full px-4 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {isGroup
                  ? groupChat?.chatName
                  : `${friend?.fName || ""} ${friend?.lName || ""}`}
              </h3>

              {!isGroup && (
                <p
                  className={`text-sm mt-0.5 ${
                    isOnline
                      ? "text-emerald-500"
                      : "text-gray-400 dark:text-slate-500"
                  }`}
                >
                  {isOnline
                    ? "● Online"
                    : friend?.lastSeen
                    ? `Last seen ${formatLastSeen(friend.lastSeen)}`
                    : "Offline"}
                </p>
              )}

              {isGroup && (
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5">
                  {groupChat?.users?.length} members
                </p>
              )}
            </div>
          </div>

          {/* Media Preview Strip */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide">
                Media & Docs
              </p>
              <button
                onClick={() => setShowMedia(true)}
                className="flex justify-center gap-1 font-semibold items-center text-xs text-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors"
              >
                <span className="text-sm">See all</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {imageMessages.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                No media shared yet
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar h-16">
                {imageMessages.map((msg) => (
                  <img
                    key={msg._id}
                    src={msg?.media?.[0]?.url}
                    alt="media"
                    onClick={() => setShowMedia(true)}
                    className="h-full w-auto aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Email (Direct) */}
          {!isGroup && friend?.email && (
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                Email
              </p>
              <p className="text-sm text-gray-800 dark:text-slate-200">
                {friend.email}
              </p>
            </div>
          )}

          {/* Members (Group) */}
          {isGroup && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Members
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddInput(!showAddInput)}
                    className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <UserPlus size={14} />
                    Add Member
                  </button>
                )}
              </div>

              {/* Add member search */}
              {showAddInput && isAdmin && (
                <div className="mb-4 p-1 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <div className="flex gap-2">
                    <input
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Search by name or email..."
                      className="flex-1 text-sm px-3 py-1 rounded-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching}
                      className="px-3 py-2 rounded-sm hover:bg-gray-600 text-white text-sm transition-colors cursor-pointer"
                    >
                      {searching ? (
                        "..."
                      ) : (
                        <UserSearch className="text-slate-700 dark:text-white" />
                      )}
                    </button>
                  </div>

                  {searchResult?.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 px-1">
                      No users found
                    </p>
                  )}

                  {searchResult?.map((u) => (
                    <div key={u._id} className="flex items-center gap-2 mt-2">
                      <Avatar user={u} size={32} IsInside />
                      <span className="flex-1 text-sm text-gray-800 dark:text-slate-200 truncate">
                        {u.fName} {u.lName}
                      </span>
                      <button
                        onClick={() => handleAdd(u._id)}
                        className="text-xs px-2 py-1 rounded-lg hover:bg-gray-600 text-white cursor-pointer transition-colors"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Members list */}
              <div className="space-y-1">
                {groupChat?.users?.map((u) => {
                  const online = onlineUser?.has(u?._id?.toString());
                  const isSelf = u._id === user?._id;
                  const isAdminUser =
                    groupChat?.groupAdmin?._id === u._id ||
                    groupChat?.groupAdmin === u._id;

                  return (
                    <div
                      key={u._id}
                      className="flex items-center gap-3 p-2 rounded-xl group"
                    >
                      {/* ✅ always clickable — shows preview or no-photo screen */}
                      <div
                        onClick={() => setPreviewImage(u?.avatar || null)}
                        className="cursor-pointer"
                      >
                        <Avatar user={u} isOnline={online} size={38} />
                      </div>

                      <div
                        onClick={() => !isSelf && handleStartChat(u)}
                        className={`min-w-0 flex-1 ${
                          !isSelf ? "cursor-pointer" : ""
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                            {u?.fName} {u?.lName}
                          </p>
                          {isAdminUser && (
                            <Crown
                              size={12}
                              className="text-yellow-500 shrink-0"
                            />
                          )}
                          {isSelf && (
                            <span className="text-xs text-gray-400 dark:text-slate-500">
                              (you)
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs ${
                            online
                              ? "text-emerald-500"
                              : "text-gray-400 dark:text-slate-500"
                          }`}
                        >
                          {online ? "Online" : "Offline"}
                        </p>
                      </div>

                      {isAdmin && !isSelf && !isAdminUser && (
                        <button
                          onClick={() => handleRemove(u._id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex px-5 py-5 w-full items-center justify-center">
          <button
            onClick={handleClearChat}
            disabled={clearing}
            className="flex items-center cursor-pointer text-sm text-red-600 gap-1 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {clearing ? (
              <div className="flex items-center gap-2">
                <Loader />
                <span>Clearing chat...</span>
              </div>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Clear chat</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInfo;
