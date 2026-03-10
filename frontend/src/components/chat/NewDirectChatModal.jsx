import { useState } from "react";
import api from "../../api/axios";
import Avatar from "../common/Avatar";
import { X, Search } from "lucide-react";

const NewDirectChatModal = ({ onClose, setSelectedChat }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (value) => {
    setQuery(value);

    if (!value.trim()) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/users/search?query=${value}`); // ✅ ?query= not ?q=
      setUsers(res.data.users || []); // ✅ res.data.users not res.data
    } catch (err) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (userId) => {
    const res = await api.post("/chats", { userId });
    setSelectedChat(res.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-900 w-80 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">New Chat</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {/* Search Input */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              value={query}
              onChange={(e) => searchUsers(e.target.value)}
            />
          </div>

          {/* Results */}
          <div className="space-y-1 max-h-60 overflow-y-auto hide-scrollbar">
            {loading && (
              <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-4">Searching...</p>
            )}

            {!loading && query && users.length === 0 && (
              <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-4">No users found</p>
            )}

            {users.map((user) => (
              <div
                key={user._id}
                onClick={() => startChat(user._id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <Avatar user={user} IsInside={true} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {user.fName} {user.lName}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default NewDirectChatModal;