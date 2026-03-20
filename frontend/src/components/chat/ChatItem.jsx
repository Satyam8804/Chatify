import { useState } from "react";
import { useAuth } from "../../context/authContext";
import { formatLastSeen } from "../../utils/formatMessageDate";
import Avatar from "../common/Avatar";
import {
  Image,
  Music,
  Video,
  FileText,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import ImagePreview from "../chat/ImagePreview.jsx";

const ChatItem = ({ chat, isActive, onClick, onlineUser, unreadCounts }) => {
  const { user } = useAuth();
  const [previewImage, setPreviewImage] = useState(undefined);

  if (!user || !chat?.users) return null;

  const userId = user._id;
  const isGroup = chat.isGroupChat;

  let friend = null;
  if (!isGroup && userId && Array.isArray(chat?.users)) {
    friend = chat.users.find((u) => u?._id?.toString() !== userId?.toString());
  }

  const isOnline = onlineUser?.has(friend?._id?.toString());
  const unread = unreadCounts?.[chat._id] || 0;
  const media = chat?.lastMessage?.media?.[0]?.name || "";
  const ext = media.split(".").pop()?.toLowerCase();

  return (
    <>
      {/* ✅ Outside clickable div — prevents click bubbling */}
      {previewImage !== undefined && (
        <ImagePreview
          url={previewImage}
          onClose={() => setPreviewImage(undefined)}
        />
      )}

      <div
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 m-1 rounded-2xl cursor-pointer border-b border-gray-100 dark:border-slate-700/50 transition-colors
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
            <Avatar user={friend} isOnline={isOnline} />
          </div>
        )}

        {/* Middle Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p
              className={`text-sm truncate font-semibold ${
                isActive
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-gray-800 dark:text-slate-100"
              }`}
            >
              {isGroup ? chat.chatName : `${friend?.fName} ${friend?.lName}`}
            </p>

            {unread > 0 && (
              <span className="ml-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full shrink-0">
                {unread}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-0.5">
            {/* Tick */}
            {chat?.lastMessage?.sender?._id === user?._id &&
              (chat?.lastMessage?.readBy?.length > 1 ? (
                <BsCheckAll color="#34d399" size={14} className="shrink-0" />
              ) : (
                <BsCheck color="gray" size={14} className="shrink-0" />
              ))}

            <div className="text-[12px] text-gray-500 dark:text-slate-400 truncate flex items-center gap-1">
              {chat?.lastMessage?.messageType === "call" ? (
                <>
                  {/* Single Icon */}
                  {chat.lastMessage.callData?.callType === "video" ? (
                    <Video
                      size={14}
                      className={`shrink-0  text-gray-400`}
                    />
                  ) : (
                    <Phone
                      size={12}
                      className={`shrink-0 text-gray-400
                      }`}
                    />
                  )}

                  {/* Text */}
                  <span
                    className={
                      chat.lastMessage.callData?.status === "missed"
                        ? "text-red-600"
                        : "text-green-400"
                    }
                  >
                    {chat.lastMessage.callData?.status === "missed"
                      ? "Missed"
                      : chat.lastMessage.sender?._id === user?._id
                      ? "Outgoing"
                      : "Incoming"}{" "}
                    {chat.lastMessage.callData?.callType === "video"
                      ? "video call"
                      : "audio call"}
                  </span>
                </>
              ) : chat?.lastMessage?.content ? (
                <span className="truncate">{chat.lastMessage.content}</span>
              ) : ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? (
                <>
                  <Image size={12} className="text-blue-500 shrink-0" />
                  <span>Photo</span>
                </>
              ) : ["mp4", "webm", "mov"].includes(ext) ? (
                <>
                  <Video size={12} className="text-purple-500 shrink-0" />
                  <span>Video</span>
                </>
              ) : ["mp3", "wav", "ogg"].includes(ext) ? (
                <>
                  <Music size={12} className="text-green-400 shrink-0" />
                  <span>Audio</span>
                </>
              ) : media ? (
                <>
                  <FileText size={12} className="text-red-400 shrink-0" />
                  <span>Document</span>
                </>
              ) : (
                <span>No messages yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Last Seen / Online */}
        {!isGroup && (
          <div className="text-xs whitespace-nowrap shrink-0">
            {isOnline ? (
              <span className="text-emerald-500 font-medium">online</span>
            ) : friend?.lastSeen ? (
              <span className="text-[10px] text-gray-400 dark:text-slate-500">
                {formatLastSeen(friend.lastSeen)}
              </span>
            ) : (
              <span className="text-gray-400 dark:text-slate-500">offline</span>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ChatItem;
