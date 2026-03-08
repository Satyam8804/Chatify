import { useAuth } from "../../context/authContext";
import { useSocket } from "../../context/socketContext";
import { formatLastSeen } from "../../utils/formatMessageDate";
import Avatar from "../common/Avatar";
import { getAvatarColor } from "../../utils/getAvatarColor";
import { getInitials } from "../../utils/getInitials";

const ChatHeader = ({ chat, setSelectedChat }) => {
  const { user } = useAuth();
  const { onlineUser } = useSocket();

  const userId = user?._id;
  const isGroup = chat?.isGroupChat;

  let friend = null;

  if (!isGroup && Array.isArray(chat?.users)) {
    friend = chat.users.find((u) => {
      const id = typeof u === "string" ? u : u?._id;
      return id !== userId;
    });
  }

  const friendObj = typeof friend === "object" ? friend : null;
  const isOnline = onlineUser?.has(friendObj?._id?.toString());

  return (
    <div className="h-16 px-4 flex items-center gap-3 bg-white">
      {/* Mobile Back Button */}
      {setSelectedChat && (
        <button
          onClick={() => setSelectedChat(null)}
          className="md:hidden text-xl font-semibold cursor-pointer"
        >
          ←
        </button>
      )}

      {/* Avatar */}
      {isGroup ? (
        <div className="w-10 h-10 rounded-full overflow-hidden grid grid-cols-2 grid-rows-2">
          {chat.users.slice(0, 4).map((u) => {
            const bg = getAvatarColor(u?._id || u?.fName);

            return (
              <div
                key={u._id}
                className="flex items-center justify-center text-white text-[9px] font-semibold"
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
        <Avatar user={friendObj} isOnline={isOnline} />
      )}

      {/* Name + Status */}
      <div className="flex flex-col">
        <p className="font-medium">
          {isGroup
            ? chat?.chatName
            : `${friendObj?.fName || ""} ${friendObj?.lName || ""}`}
        </p>

        {!isGroup && (
          <p
            className={`text-xs ${
              isOnline ? "text-green-600" : "text-gray-400"
            }`}
          >
            {isOnline
              ? "Online"
              : friendObj?.lastSeen
              ? `Last seen ${formatLastSeen(friendObj.lastSeen)}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
