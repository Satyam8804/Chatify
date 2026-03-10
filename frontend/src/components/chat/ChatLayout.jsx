import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import { useState } from "react";
import EmptyChatState from "./EmptyChatState";

const ChatLayout = () => {
  const [selectedChat, setSelectedChat] = useState(null);

  return (
    <div className="h-screen w-full flex bg-gray-100 dark:bg-slate-950 transition-colors">
      {/* Sidebar */}
      <div
        className={`
          ${selectedChat ? "hidden md:block" : "block"}
          w-full md:w-80 bg-white dark:bg-slate-900 shrink-0
        `}
      >
        <Sidebar
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
        />
      </div>

      {/* Chat Window */}
      <div
        className={`
          ${selectedChat ? "block" : "hidden md:block"}
          flex-1 bg-gray-100 dark:bg-slate-950 min-w-0
        `}
      >
        {selectedChat ? (
          <ChatWindow chat={selectedChat} setSelectedChat={setSelectedChat} />
        ) : (
          <EmptyChatState />
        )}
      </div>
    </div>
  );
};

export default ChatLayout;
