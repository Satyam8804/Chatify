import { useState } from "react";
import { useAuth } from "../../context/authContext";
import { useSocket } from "../../context/socketContext";
import { formatLastSeen } from "../../utils/formatMessageDate";
import Avatar from "../common/Avatar";
import { getAvatarColor } from "../../utils/getAvatarColor";
import { getInitials } from "../../utils/getInitials";
import { ArrowLeft, Video } from "lucide-react";
import ChatInfo from "./ChatInfo";

const ChatHeader = ({
  chat, setSelectedChat, messages, onClearChat, startCall, isCalling,
}) => {
  const { user }      = useAuth();
  const { onlineUser } = useSocket();
  const [showInfo, setShowInfo] = useState(false);

  const userId  = user?._id;
  const isGroup = chat?.isGroupChat;

  let friend = null;
  if (!isGroup && Array.isArray(chat?.users)) {
    friend = chat.users.find((u) => {
      const id = typeof u === "string" ? u : u?._id;
      return id !== userId;
    });
  }

  const friendObj = typeof friend === "object" ? friend : null;
  const isOnline  = onlineUser?.has(friendObj?._id?.toString());

  return (
    <>
      <div className="h-16 px-3 flex items-center gap-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 transition-colors">
        {setSelectedChat && (
          <button
            onClick={() => setSelectedChat(null)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => setShowInfo(true)}
        >
          {isGroup ? (
            <div className="w-10 h-10 rounded-full overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0">
              {chat.users.slice(0, 4).map((u) => {
                const bg = getAvatarColor(u?._id || u?.fName);
                return (
                  <div
                    key={u._id}
                    className="flex items-center justify-center text-white text-[9px] font-semibold"
                    style={{ backgroundColor: u?.avatar ? "transparent" : bg }}
                  >
                    {u?.avatar ? (
                      <img src={u.avatar} alt={u.fName} className="w-full h-full object-cover" />
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

          <div className="flex flex-col min-w-0">
            <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
              {isGroup
                ? chat?.chatName
                : `${friendObj?.fName || ""} ${friendObj?.lName || ""}`}
            </p>

            {isGroup ? (
              <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                {chat?.users.slice(0, 4).map((u) => u?.fName).join(", ")}
                {chat?.users.length > 4 && `, +${chat.users.length - 4}`}
              </span>
            ) : (
              <p className={`text-xs ${isOnline ? "text-emerald-500" : "text-gray-400 dark:text-slate-500"}`}>
                {isOnline
                  ? "Online"
                  : friendObj?.lastSeen
                  ? `Last seen ${formatLastSeen(friendObj.lastSeen)}`
                  : ""}
              </p>
            )}
          </div>
        </div>

        {startCall && (
          <button
            onClick={() => startCall(chat)} // ✅ disabled handles the guard
            disabled={isCalling}
            title={isCalling ? "Call already in progress" : "Start video call"}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
              isCalling
                ? "text-gray-400 cursor-not-allowed opacity-50"
                : "text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-emerald-500 dark:hover:text-emerald-400"
            }`}
          >
            <Video size={20} />
          </button>
        )}
      </div>

      {showInfo && (
        <ChatInfo
          chat={chat}
          friend={friendObj}
          isGroup={isGroup}
          isOnline={isOnline}
          messages={messages}
          onClose={() => setShowInfo(false)}
          setSelectedChat={setSelectedChat}
          onClearChat={onClearChat}
        />
      )}
    </>
  );
};

export default ChatHeader;