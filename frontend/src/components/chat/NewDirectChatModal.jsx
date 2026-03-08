import { useState } from "react";
import api from "../../api/axios";
import Avatar from "../common/Avatar";

const NewDirectChatModal = ({ onClose, setSelectedChat }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);

  const searchUsers = async (value) => {
    setQuery(value);

    if (!value.trim()) {
      setUsers([]);
      return;
    }

    const res = await api.get(`/users/search?q=${value}`);
    setUsers(res.data);
  };

  const startChat = async (userId) => {
    const res = await api.post("/chats", { userId });
    setSelectedChat(res.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center">

      <div className="bg-white w-80 rounded-xl p-4">

        <h3 className="font-semibold mb-3">Start New Chat</h3>

        {/* Search Input */}
        <input
          placeholder="Search user..."
          className="w-full border p-2 rounded mb-3"
          value={query}
          onChange={(e) => searchUsers(e.target.value)}
        />

        {/* Results */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {users.map((user) => (
            <div
              key={user._id}
              onClick={() => startChat(user._id)}
              className="p-2 hover:bg-gray-100 rounded cursor-pointer"
            >
            
              <div className="flex items-center gap-2">
                <Avatar user={user} IsInside={true}/>
                <span className="text-sm">{user.fName} {user.lName}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-3 text-sm text-gray-500"
        >
          Cancel
        </button>

      </div>

    </div>
  );
};

export default NewDirectChatModal;