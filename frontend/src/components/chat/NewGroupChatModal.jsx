import { useState } from "react";
import api from "../../api/axios";
import Avatar from "../common/Avatar";
import { logger } from "../../utils/logger";

const NewGroupChatModal = ({ onClose, setSelectedChat }) => {
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const searchUsers = async (value) => {
    setQuery(value);

    if (!value.trim()) {
      setUsers([]);
      return;
    }

    try {
      const res = await api.get(`/users/search?q=${value}`);
      setUsers(res.data);
    } catch (err) {
      logger(err.message);
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
  const removeUser = (userId) => {
    setSelectedUsers((prev) => prev.filter((u) => u._id !== userId));
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center">
      <div className="bg-white w-96 rounded-xl p-5">
        <h3 className="font-semibold mb-4 text-lg">Create Group</h3>

        {/* Group Name */}
        <input
          placeholder="Group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full border rounded p-2 mb-3"
        />

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 ">
            {selectedUsers.map((user) => (
              <span
                key={user._id}
                className="cursor-pointer text-sm px-2 py-1 rounded"
              >
                <div className="relative w-fit">
                  <Avatar user={user} IsInside={true} />
                  <button
                    onClick={() => removeUser(user._id)}
                    className="absolute bottom-2 right-1 translate-x-1/4 translate-y-1/4 
    rotate-45 text-[18px] cursor-pointer text-white bg-gray-500 
    rounded-full w-4 h-4 flex items-center justify-center shadow"
                  >
                    +
                  </button>
                </div>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          placeholder="Search users..."
          value={query}
          onChange={(e) => searchUsers(e.target.value)}
          className="w-full border rounded p-2 mb-3"
        />

        {/* Search Results */}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {users.map((user) => {
            const isSelected = selectedUsers.some((u) => u._id === user._id);

            return (
              <div
                key={user._id}
                onClick={() => toggleUser(user)}
                className={`p-2 rounded cursor-pointer flex justify-between ${
                  isSelected ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Avatar user={user} IsInside={true} />
                  <span className="text-sm">
                    {user.fName} {user.lName}
                  </span>
                </div>

                {isSelected && (
                  <span className="text-blue-500 font-bold">✓</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="text-gray-500 cursor-pointer text-sm"
          >
            Cancel
          </button>

          <button
            onClick={createGroup}
            className="bg-blue-500 text-white cursor-pointer px-3 py-1 rounded text-sm"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGroupChatModal;
