import { v2 as cloudinary } from "cloudinary";
import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────
export const getPublicIdFromUrl = (url) => {
  const parts = url.split("/upload/");
  if (!parts[1]) return null;
  const withoutVersion = parts[1].replace(/^v\d+\//, ""); // remove v1234567/
  const withoutExt = withoutVersion.replace(/\.[^/.]+$/, ""); // remove extension
  return withoutExt; // e.g. "chat-media/filename"
};

export const getResourceTypeFromUrl = (url) => {
  if (url.includes("/video/")) return "video";
  if (url.includes("/raw/")) return "raw";
  return "image";
};

// ─── Send Message ──────────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { chatId, content, replyTo } = req.body;

    if (!chatId || !content) {
      return res
        .status(400)
        .json({ message: "chatId and content are required!" });
    }

    let message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      content,
      readBy: [req.user._id],
      replyTo: replyTo || null,
    });

    message = await message.populate("sender", "fName lName email avatar");
    message = await message.populate("chat");
    message = await message.populate({
      path: "replyTo",
      populate: { path: "sender", select: "fName avatar" },
    });

    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Fetch Messages ────────────────────────────────────────────────────────────
export const fetchMessageOfChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "fName lName email avatar")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "fName avatar" },
      })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Mark Messages As Seen ────────────────────────────────────────────────────
export const markMessagesAsSeen = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const result = await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId }, // don't mark own messages
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    res.json({
      message: "Messages marked as seen",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Clear Chat ────────────────────────────────────────────────────────────────
export const clearChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    // 1️⃣ fetch all messages
    const messages = await Message.find({ chat: chatId });

    // 2️⃣ delete media from Cloudinary using URL-derived public_id
    for (const message of messages) {
      if (message.media?.length > 0) {
        for (const m of message.media) {
          if (m.url) {
            const public_id = getPublicIdFromUrl(m.url);
            const resource_type = getResourceTypeFromUrl(m.url);
            if (public_id) {
              await cloudinary.uploader.destroy(public_id, { resource_type });
            }
          }
        }
      }
    }

    // 3️⃣ delete all messages from DB
    await Message.deleteMany({ chat: chatId });

    // 4️⃣ clear lastMessage on chat
    await Chat.findByIdAndUpdate(chatId, { lastMessage: null });

    res.json({ message: "Chat cleared successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
