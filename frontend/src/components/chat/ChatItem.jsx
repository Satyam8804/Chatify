import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/authContext";
import Avatar from "../common/Avatar";
import {
  Image,
  Music,
  Video,
  FileText,
  Phone,
  Pin,
  MailOpen,
  Heart,
  ListPlus,
  Ban,
  Trash2,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import ImagePreview from "../chat/ImagePreview.jsx";
import { DoubleTick, SingleTick } from "../common/TickIcons.jsx";

// ─── Chat Context Menu ────────────────────────────────────────────────────────
const ChatContextMenu = ({
  isOpen,
  chat,
  onClose,
  onAction,
  menuRef,
  isBlockedByMe,
}) => {
  const menuItems = [
    {
      label: chat?.isPinned ? "Unpin chat" : "Pin chat",
      icon: (
        <Pin size={14} className={chat?.isPinned ? "text-emerald-500" : ""} />
      ),
      action: "pin",
    },
    {
      label: "Mark as unread",
      icon: <MailOpen size={14} />,
      action: "unread",
    },
    {
      label: chat?.isFavourite ? "Remove from favourites" : "Add to favourites",
      icon: (
        <Heart
          size={14}
          className={chat?.isFavourite ? "fill-yellow-400 text-yellow-400" : ""}
        />
      ),
      action: "favourite",
    },
    { divider: true },
    {
      label: isBlockedByMe ? "Unblock" : "Block", // ✅ toggle label
      icon: <Ban size={14} className={isBlockedByMe ? "text-red-400" : ""} />,
      action: "block", // same action — Sidebar toggles either way
      danger: true,
    },
    {
      label: "Clear chat",
      icon: <XCircle size={14} />,
      action: "clear",
      danger: true,
    },
    {
      label: "Delete chat",
      icon: <Trash2 size={14} />,
      action: "delete",
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: "calc(100% - 8px)",
        right: 0,
        minWidth: "190px",
        zIndex: 100,
        transformOrigin: "top right",
        transform: isOpen ? "scale(1)" : "scale(0.88)",
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
        transition:
          "transform 0.15s cubic-bezier(0.34,1.56,0.64,1), opacity 0.12s ease",
      }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, i) =>
        item.divider ? (
          <div
            key={i}
            className="border-t border-gray-100 dark:border-slate-700 my-1"
          />
        ) : (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onAction?.(item.action);
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-[8px] text-[12.5px] text-left cursor-pointer transition-colors
              ${
                item.danger
                  ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
          >
            <span
              className={
                item.danger
                  ? "text-red-400"
                  : "text-gray-400 dark:text-slate-500"
              }
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
};

// ─── ChatItem ─────────────────────────────────────────────────────────────────
const ChatItem = ({
  chat,
  isActive,
  onClick,
  onlineUser,
  unreadCounts,
  onChatAction,
}) => {
  const { user } = useAuth();
  const [previewImage, setPreviewImage] = useState(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  if (!user || !chat?.users) return null;

  const userId = user._id;
  const isGroup = chat.isGroupChat;

  let friend = null;
  if (!isGroup && userId && Array.isArray(chat?.users)) {
    friend = chat.users.find((u) => u?._id?.toString() !== userId?.toString());
  }

  const isBlockedByMe = user?.blockedUsers
    ?.map((id) => id.toString())
    .includes(friend?._id?.toString());

  const isBlockedByThem = friend?.blockedUsers
    ?.map((id) => id.toString())
    .includes(user?._id?.toString());

  const isBlocked = isBlockedByMe || isBlockedByThem;

  const isOnline = onlineUser?.has(friend?._id?.toString());
  const unread = unreadCounts?.[chat._id] || 0;
  const lastMsg = chat?.lastMessage;
  const media = lastMsg?.media?.[0]?.name || "";
  const ext = media.split(".").pop()?.toLowerCase();

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const renderLastMessage = () => {
    if (!lastMsg) return <span>No messages yet</span>;

    // Deleted message
    if (lastMsg.isDeleted) {
      return (
        <span className="italic text-gray-400 dark:text-slate-500">
          🚫{" "}
          {lastMsg.sender?._id === userId
            ? "You deleted this message"
            : "This message was deleted"}
        </span>
      );
    }

    if (lastMsg.messageType === "call") {
      const isMissed = lastMsg.callData?.status === "missed";
      const isVideo = lastMsg.callData?.callType === "video";
      const isOutgoing = lastMsg.sender?._id === userId;
      return (
        <>
          {isVideo ? (
            <Video size={12} className="shrink-0 text-gray-400" />
          ) : (
            <Phone size={12} className="shrink-0 text-gray-400" />
          )}
          <span className={isMissed ? "text-red-500" : "text-green-400"}>
            {isMissed ? "Missed" : isOutgoing ? "Outgoing" : "Incoming"}{" "}
            {isVideo ? "video call" : "audio call"}
          </span>
        </>
      );
    }

    // Text content
    if (lastMsg.content) {
      return <span className="truncate">{lastMsg.content}</span>;
    }

    // Media
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext))
      return (
        <>
          <Image size={12} className="text-blue-500 shrink-0" />
          <span>Photo</span>
        </>
      );
    if (["mp4", "webm", "mov"].includes(ext))
      return (
        <>
          <Video size={12} className="text-purple-500 shrink-0" />
          <span>Video</span>
        </>
      );
    if (["mp3", "wav", "ogg"].includes(ext))
      return (
        <>
          <Music size={12} className="text-green-400 shrink-0" />
          <span>Audio</span>
        </>
      );
    if (media)
      return (
        <>
          <FileText size={12} className="text-red-400 shrink-0" />
          <span>Document</span>
        </>
      );

    return <span>No messages yet</span>;
  };

  const renderTimestamp = () => {
    if (!lastMsg?.createdAt) return null;
    const date = new Date(lastMsg.createdAt);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);

    let label = "";
    if (days === 0) {
      label = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      label = "Yesterday";
    } else if (days < 7) {
      label = date.toLocaleDateString([], { weekday: "short" });
    } else {
      label = date.toLocaleDateString([], {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
    }

    return (
      <span className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap">
        {label}
      </span>
    );
  };

  return (
    <div className="h-20">
      {previewImage !== undefined && (
        <ImagePreview
          url={previewImage}
          onClose={() => setPreviewImage(undefined)}
        />
      )}

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
        }}
        onClick={onClick}
        className={`relative flex items-center gap-3 px-4 py-3 m-1 rounded-2xl cursor-pointer transition-colors
          ${
            isActive
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-transparent"
              : "hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
      >
        {/* Avatar */}
        {isGroup ? (
          <Avatar users={chat?.users} isGroup />
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(friend?.avatar || null);
            }}
            className="cursor-pointer hover:opacity-90 transition-opacity shrink-0"
          >
            <Avatar user={friend} isOnline={!isBlocked && isOnline} />
          </div>
        )}

        {/* Middle Content */}
        <div className="flex-1 justify-between flex min-w-0">
          {/* Name row */}
          <div className="flex flex-col gap-1">
            <p
              className={`text-sm truncate font-semibold ${
                isActive
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-gray-800 dark:text-slate-100"
              }`}
            >
              {isGroup ? chat.chatName : `${friend?.fName} ${friend?.lName}`}
            </p>

            <div className="flex items-center gap-1 mt-0.5">
              {lastMsg?.sender?._id === userId &&
                (lastMsg?.readBy?.length > 1 ? (
                  <DoubleTick size={14} color="#34d399" className="shrink-0" />
                ) : (
                  <SingleTick size={14} color="#94a3b8" className="shrink-0" />
                ))}

              <div className="text-[12px] text-gray-500 dark:text-slate-400 truncate flex items-center gap-1">
                {renderLastMessage()}
              </div>
            </div>
          </div>
          {/* Timestamp + unread badge */}

          <div className="flex flex-col items-end gap-1 shrink-0 min-w-[72px]">
            <div className="text-right">{renderTimestamp()}</div>

            <div className="relative flex items-center justify-end min-h-[22px]">
              <div
                className={`flex items-center gap-2 pr-1 transition-transform duration-200 ${
                  hovered || menuOpen ? "-translate-x-5" : "translate-x-0"
                }`}
              >
                {chat.isPinned && (
                  <Pin
                    size={14}
                    className="shrink-0 text-emerald-500 rotate-45"
                  />
                )}

                {unread > 0 && (
                  <div className="bg-emerald-500 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-[10px]">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  </div>
                )}
              </div>

              <div
                className={`absolute right-0 top-0 z-20 transition-all duration-200 ${
                  hovered || menuOpen
                    ? "opacity-100 translate-x-0 pointer-events-auto"
                    : "opacity-0 translate-x-2 pointer-events-none"
                }`}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((p) => !p);
                  }}
                  className="p-1 cursor-pointer rounded-full text-gray-400 hover:text-emerald-500 hover:bg-gray-200 dark:hover:bg-slate-700"
                >
                  <ChevronDown size={14} />
                </button>

                <ChatContextMenu
                  isOpen={menuOpen}
                  menuRef={menuRef}
                  chat={chat}
                  isBlockedByMe={isBlockedByMe}
                  onClose={() => setMenuOpen(false)}
                  onAction={(action) => onChatAction?.(action, chat)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatItem;
