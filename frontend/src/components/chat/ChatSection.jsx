import ChatItem from "./ChatItem";

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
    <div className="space-y-2">
      {/* Section Title */}
      <div className="flex justify-between items-center ">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </h3>
        <button
          onClick={onAddClick}
          className=" text-2xl font-bold  rounded-full hover:text-gray-500 text-gray-400 cursor-pointer"
        >
          +
        </button>
      </div>
      {chats.length === 0 && (
        <p className="px-3 mt-1 text-xs text-gray-400">
          {title === "DIRECT MESSAGES"
            ? "Start a private conversation"
            : "Create a group to chat"}
        </p>
      )}
      {/* Chat List */}
      <div className="space-y-1">
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
