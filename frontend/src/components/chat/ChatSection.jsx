import ChatItem from "./ChatItem";

const ChatSection = ({
  chat,
  isActive,
  onClick,
  onlineUser,
  unreadCounts,
  onChatAction,
}) => {
  return (
    <ChatItem
      chat={chat}
      onlineUser={onlineUser}
      isActive={isActive}
      onClick={onClick}
      unreadCounts={unreadCounts}
      onChatAction={onChatAction}
    />
  );
};

export default ChatSection;
