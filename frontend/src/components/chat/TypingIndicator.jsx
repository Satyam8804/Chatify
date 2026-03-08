import Avatar from "../common/Avatar";

const TypingIndicator = ({ user }) => {
  if (!user) return null;
  return (
    <div className="flex items-end gap-2 py-2">
      <Avatar user={user} size={24} IsInside={true}/>
      <div className=" flex items-center gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
      </div>
    </div>
  );
};

export default TypingIndicator;
