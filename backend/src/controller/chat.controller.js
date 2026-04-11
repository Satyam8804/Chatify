import User from "../models/user.model.js"; // ← add this
import Chat from "../models/chat.model.js";

export const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId)
      return res.status(400).json({ message: "UserId is Required!" });

    // ✅ Block checks
    const currentUser = await User.findById(req.user._id);
    const otherUser = await User.findById(userId);

    if (!otherUser) return res.status(404).json({ message: "User not found" });

    if (currentUser.blockedUsers.map((id) => id.toString()).includes(userId))
      return res.status(403).json({ message: "You have blocked this user" });

    if (
      otherUser.blockedUsers
        .map((id) => id.toString())
        .includes(req.user._id.toString())
    )
      return res.status(403).json({ message: "You cannot message this user" });

    const chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [req.user._id, userId] },
    })
      .populate("users", "-password")
      .populate("lastMessage");

    if (chat) return res.json(chat);

    const newChat = await Chat.create({
      isGroupChat: false,
      users: [req.user._id, userId],
    });

    const fullChat = await Chat.findById(newChat._id).populate(
      "users",
      "-password"
    );

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

export const updateChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) return res.status(404).json({ message: "Chat not found" });

    if (!chat.users.some((u) => u.toString() === req.user._id.toString()))
      return res.status(403).json({ message: "Not authorized" });

    const allowed = ["isFavourite", "isPinned", "chatName", "groupAvatar"];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) chat[field] = req.body[field];
    });

    if (req.body.toggle) {
      const field = req.body.toggle;
      if (allowed.includes(field)) chat[field] = !chat[field];
    }

    await chat.save();

    // ✅ Re-fetch with full population instead of returning raw save
    const updated = await Chat.findById(chat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "fName avatar" },
      });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) return res.status(404).json({ message: "Chat not found" });

    if (!chat.users.some((u) => u.toString() === req.user._id.toString()))
      return res.status(403).json({ message: "Not authorized" });

    await Chat.findByIdAndDelete(req.params.id);

    // Notify all members
    chat.users.forEach((u) => {
      req.io.to(u.toString()).emit("chat-deleted", { chatId: req.params.id });
    });

    res.json({ message: "Chat deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
