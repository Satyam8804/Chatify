import ChatItem from "./ChatItem";
import { Plus } from "lucide-react";

const ChatSection = ({
  title,
  chats,
  selectedChat,
  onlineUser,
  setSelectedChat,
  unreadCounts,
  onAddClick,
}) => {
  return (
    <div className="space-y-2 pt-3">

      {/* Section Title */}
      <div className="flex justify-between items-center px-2">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
          {title}
        </h3>
        <button
          onClick={onAddClick}
          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Empty State */}
      {chats.length === 0 && (
        <p className="px-3 text-xs text-gray-400 dark:text-slate-600">
          {title === "DIRECT MESSAGES"
            ? "Start a private conversation"
            : "Create a group to chat"}
        </p>
      )}

      {/* Chat List */}
      <div className="space-y-0.5">
        {chats.map((chat) => (
          <ChatItem
            key={chat._id}
            chat={chat}
            onlineUser={onlineUser}
            isActive={selectedChat?._id === chat._id}
            onClick={() => setSelectedChat(chat)}
            unreadCounts={unreadCounts}
          />
        ))}
      </div>

    </div>
  );
};

export default ChatSection;