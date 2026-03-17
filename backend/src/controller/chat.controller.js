import Chat from "../models/chat.model.js";

export const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "UserId is Required !" });
    }

    const chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [req.user._id, userId] },
    })
      .populate("users", "-password")
      .populate("lastMessage");

    if (chat) {
      return res.json(chat); // existing chat — no need to emit
    }

    const newChat = await Chat.create({
      isGroupChat: false,
      users: [req.user._id, userId],
    });

    const fullChat = await Chat.findById(newChat._id).populate(
      "users",
      "-password"
    );

    // ✅ notify both users to join the new chat room
    fullChat.users.forEach((u) => {
      req.io.to(u._id.toString()).emit("new-chat-created", fullChat);
    });

    res.status(201).json(fullChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const fetchAllChat = async (req, res) => {
  try {
    const chats = await Chat.find({
      users: { $in: [req.user._id] },
    })
      .populate("users", "-password")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "fName avatar" }, // ✅
      })
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createGroupChat = async (req, res) => {
  try {
    const { name, users } = req.body;

    if (!name || !users) {
      return res.status(400).json({
        message: "Group name and at least 2 users are required!",
      });
    }

    const parsedUsers = Array.isArray(users) ? users : JSON.parse(users);

    if (parsedUsers.length < 2) {
      return res.status(400).json({
        message: "Group must contain at least 2 users",
      });
    }

    const allUsers = [...new Set([...parsedUsers, req.user._id.toString()])];

    const groupChat = await Chat.create({
      chatName: name,
      users: allUsers,
      isGroupChat: true,
      groupAdmin: req.user._id,
    });

    const fullChat = await Chat.findById(groupChat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    // ✅ notify all group members to join the new chat room
    fullChat.users.forEach((u) => {
      req.io.to(u._id.toString()).emit("new-chat-created", fullChat);
    });

    res.status(201).json(fullChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res
        .status(400)
        .json({ message: "chatId and userId are required" });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) return res.status(404).json({ message: "Chat not found" });

    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only admin can add members" });
    }

    if (chat.users.includes(userId)) {
      return res.status(400).json({ message: "User already in group" });
    }

    const updated = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { users: userId } },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.json({ updated, message: "User added to the group" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res
        .status(400)
        .json({ message: "chatId and userId are required" });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) return res.status(404).json({ message: "Chat not found" });

    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only admin can remove members" });
    }

    if (chat.groupAdmin.toString() === userId) {
      return res
        .status(400)
        .json({ message: "Cannot remove admin from group" });
    }

    const updated = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userId } },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.json({ updated, message: `User Removed from the group` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
