import { useState } from "react";
import api from "../../api/axios";
import Avatar from "../common/Avatar";
import { logger } from "../../utils/logger";
import { X, Search, Check } from "lucide-react";

const NewGroupChatModal = ({ onClose, setSelectedChat }) => {
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (value) => {
    setQuery(value);
    if (!value.trim()) { setUsers([]); return; }
    try {
      setLoading(true);
      const res = await api.get(`/users/search?query=${value}`); // ✅ fixed
      setUsers(res.data.users || []); // ✅ fixed
    } catch (err) {
      logger(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (user) => {
    const exists = selectedUsers.find((u) => u._id === user._id);
    if (exists) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const removeUser = (userId) => {
    setSelectedUsers((prev) => prev.filter((u) => u._id !== userId));
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length < 2) return;
    try {
      const res = await api.post("/chats/group", {
        name: groupName,
        users: selectedUsers.map((u) => u._id),
      });
      setSelectedChat(res.data);
      onClose();
    } catch (err) {
      logger(err.message);
    }
  };

  const canCreate = groupName.trim() && selectedUsers.length >= 2;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-900 w-96 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">

        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base">Create Group</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* Group Name */}
          <input
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <div key={user._id} className="relative w-fit">
                  <Avatar user={user} IsInside size={36} />
                  <button
                    onClick={() => removeUser(user._id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 dark:bg-slate-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow text-[10px]"
                  >
                    <X size={8} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              placeholder="Search users..."
              value={query}
              onChange={(e) => searchUsers(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Search Results */}
          <div className="max-h-48 overflow-y-auto hide-scrollbar space-y-1">
            {loading && (
              <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-3">Searching...</p>
            )}
            {!loading && query && users.length === 0 && (
              <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-3">No users found</p>
            )}
            {users.map((user) => {
              const isSelected = selectedUsers.some((u) => u._id === user._id);
              return (
                <div
                  key={user._id}
                  onClick={() => toggleUser(user)}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors
                    ${isSelected
                      ? "bg-emerald-50 dark:bg-emerald-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-slate-800"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar user={user} IsInside size={36} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {user.fName} {user.lName}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{user.email}</p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Helper text */}
          {selectedUsers.length > 0 && selectedUsers.length < 2 && (
            <p className="text-xs text-amber-500 dark:text-amber-400">Add at least 2 members to create a group</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={createGroup}
              disabled={!canCreate}
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors cursor-pointer"
            >
              Create Group
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default NewGroupChatModal;