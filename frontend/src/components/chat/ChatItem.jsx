import { useAuth } from "../../context/authContext";
import { getInitials } from "../../utils/getInitials";
import { formatLastSeen } from "../../utils/formatMessageDate";
import { getAvatarColor } from "../../utils/getAvatarColor";
import Avatar from "../common/Avatar";

const ChatItem = ({ chat, isActive, onClick, onlineUser, unreadCounts }) => {
  const { user } = useAuth();

  if (!user || !chat?.users) return null;

  const userId = user._id;
  const isGroup = chat.isGroupChat;
  let friend = null;

  if (!isGroup && userId && Array.isArray(chat?.users)) {
    friend = chat.users.find((u) => u?._id?.toString() !== userId?.toString());
  }

  const isOnline = onlineUser?.has(friend?._id?.toString());
  const unread = unreadCounts?.[chat._id] || 0;
  const groupColor = getAvatarColor(chat?._id || chat?.chatName);
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 m-1 rounded-2xl hover:bg-gray-200 cursor-pointer border-b border-gray-200 transition ${
        isActive ? "bg-gray-300" : ""
      }`}
    >
      {/* Avatar */}
      {isGroup ? (
        <div className="w-10 h-10 rounded-full overflow-hidden grid grid-cols-2 grid-rows-2">
          {chat.users.slice(0, 4).map((u) => {
            const bg = getAvatarColor(u?._id || u?.fName);

            return (
              <div
                key={u._id}
                className="flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden"
                style={{ backgroundColor: u?.avatar ? "transparent" : bg }}
              >
                {u?.avatar ? (
                  <img
                    src={u.avatar}
                    alt={u.fName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(u?.fName, u?.lName)
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Avatar user={friend} isOnline={isOnline} />
      )}

      {/* Middle Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm truncate font-bold text-gray-800">
            {isGroup ? chat.chatName : friend?.fName + " " + friend?.lName}
          </p>

          {unread > 0 && (
            <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>

        <p className="text-[12px] text-gray-500 truncate">
          {chat?.lastMessage?.content || "No messages yet"}
        </p>
      </div>

      {/* Last Seen / Online */}
      {!isGroup && (
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {isOnline ? (
            <span className="text-green-500 font-small">online</span>
          ) : friend?.lastSeen ? (
            <span className="text-[10px]">
              {formatLastSeen(friend.lastSeen)}
            </span>
          ) : (
            <span>offline</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatItem;
