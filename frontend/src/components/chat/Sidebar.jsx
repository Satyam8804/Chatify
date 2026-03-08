import { useEffect, useState } from "react";
import api from "../../api/axios";
import ChatSection from "./ChatSection";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import NewDirectChatModal from "./NewDirectChatModal";
import NewGroupChatModal from "./NewGroupChatModal";

const Sidebar = ({ selectedChat, setSelectedChat }) => {
  const { loading, user } = useAuth();
  const { onlineUser, unreadCounts, socket } = useSocket();
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [chats, setChats] = useState([]);

  const fetchAllChats = async () => {
    try {
      const res = await api.get("/chats");
      setChats(res?.data || []);
    } catch (error) {
      console.log(error.message);
    }
  };
  const updateChatLatestMessage = (newMessage) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) =>
        chat._id === newMessage.chat._id
          ? { ...chat, lastMessage: newMessage }
          : chat
      );

      const chatIndex = updatedChats.findIndex(
        (chat) => chat._id === newMessage.chat._id
      );

      if (chatIndex > -1) {
        const [updatedChat] = updatedChats.splice(chatIndex, 1);
        updatedChats.unshift(updatedChat);
      }

      return updatedChats;
    });
  };

  useEffect(() => {
    if (!user?._id) {
      setChats([]);
      return;
    }
    fetchAllChats();
  }, [user?._id]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (newMessage) => {
      updateChatLatestMessage(newMessage);
    };

    socket.on("message-received", handleMessage);

    return () => {
      socket.off("message-received", handleMessage);
    };
  }, [socket]);
  if (loading) {
    return <div className="p-4 text-gray-500 text-sm">Loading chats...</div>;
  }

  const directChats = chats.filter((chat) => !chat.isGroupChat);
  const groupChats = chats.filter((chat) => chat.isGroupChat);

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">
          Chatify
        </h2>
      </div>

      {/* Chat List */}
      <div className="flex-1 flex flex-col px-3 gap-4 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
          <ChatSection
            title="DIRECT MESSAGES"
            unreadCounts={unreadCounts}
            chats={directChats}
            selectedChat={selectedChat}
            onlineUser={onlineUser}
            setSelectedChat={setSelectedChat}
            onAddClick={() => setShowDirectModal(true)}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
          <ChatSection
            title="GROUP CHATS"
            unreadCounts={unreadCounts}
            chats={groupChats}
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            onAddClick={() => setShowGroupModal(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <div className="z-50">
        {showDirectModal && (
          <NewDirectChatModal
            onClose={() => setShowDirectModal(false)}
            setSelectedChat={setSelectedChat}
          />
        )}

        {showGroupModal && (
          <NewGroupChatModal
            onClose={() => setShowGroupModal(false)}
            setSelectedChat={setSelectedChat}
          />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
