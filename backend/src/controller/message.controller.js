import { v2 as cloudinary } from "cloudinary";
import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";

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
export const fetchMessageOfChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "fName lName email avatar")
      .populate({
        path: "chat", // ✅ ADD THIS
        select: "users isGroupChat chatName", // ✅ IMPORTANT
        populate: {
          path: "users",
          select: "fName avatar email",
        },
      })
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

export const clearChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await Message.find({ chat: chatId });

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

export const sendCallMessage = async (req, res) => {
  try {
    const {
      chatId,
      callType,
      status,
      duration = 0,
      participants = [],
      receiverId, // ✅ ADD: frontend sends this for 1-1 calls
    } = req.body;

    if (!chatId || !callType || !status) {
      return res.status(400).json({
        message: "chatId, callType and status are required",
      });
    }

    const finalParticipants = participants.length
      ? participants
      : receiverId
      ? [receiverId]
      : [];

    const payload = {
      sender: req.user._id,
      chat: chatId,
      messageType: "call",
      participants: finalParticipants, // ✅ always populated now
      callData: { callType, status, duration },
      readBy: [req.user._id],
    };

    let message = await Message.create(payload);

    message = await message.populate("sender", "fName lName email avatar");
    message = await message.populate("participants", "fName lName avatar"); // ✅ ADD
    message = await message.populate({
      path: "chat",
      select: "users isGroupChat chatName",
    });

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    req.io.to(chatId).emit("receive-message", message);

    req.io.to(chatId).emit("message-notification", {
      chatId,
      message,
    });

    const notified = new Set();

    const emitToUser = (id) => {
      const userId = id.toString();

      if (!notified.has(userId)) {
        notified.add(userId);
        req.io.to(userId).emit("call-log-saved", message);
      }
    };

    // sender
    emitToUser(req.user._id);

    message.participants?.forEach((p) => emitToUser(p._id));

    res.status(201).json(message);
  } catch (error) {
    console.error("CALL MESSAGE ERROR 👉", error);
    res.status(500).json({ message: error.message });
  }
};

export const getCallLogs = async (req, res) => {
  try {
    const userId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      messageType: "call",
      $or: [{ sender: userId }, { participants: userId }], // ✅ cleaner, no $in needed
    };

    const [logs, total] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "fName lName avatar")
        .populate("participants", "fName lName avatar")
        .populate("chat", "chatName isGroupChat"),

      Message.countDocuments(query),
    ]);

    // ✅ flatten callData + derive isGroupCall from chat
    const formattedLogs = logs.map((log) => ({
      ...log.toObject(),
      callType: log.callData?.callType,
      status: log.callData?.status,
      duration: log.callData?.duration,
      isGroupCall: log.chat?.isGroupChat || false,
    }));

    res.json({
      logs: formattedLogs,
      hasMore: skip + logs.length < total,
      page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  const message = await Message.findById(req.params.id).populate("chat");

  if (!message) return res.status(404).json({ message: "Not found" });

  const isSender = message.sender.toString() === req.user._id.toString();
  const isGroupAdmin =
    message.chat.isGroupChat &&
    message.chat.groupAdmin.toString() === req.user._id.toString();

  if (!isSender && !isGroupAdmin)
    return res.status(403).json({ message: "Not authorized" });

  if (message.isDeleted && isSender) {
    await Message.findByIdAndDelete(req.params.id);

    // 👇 notify all chat members
    req.io.to(message.chat._id.toString()).emit("message-deleted", {
      messageId: req.params.id,
      deletedPermanently: true,
    });

    return res.json({
      message: "Deleted permanently",
      deletedPermanently: true,
    });
  }

  message.isDeleted = true;
  message.deletedBy = req.user._id;
  message.deletedAt = new Date();
  message.content = "This message was deleted";
  await message.save();

  // 👇 notify all chat members
  req.io.to(message.chat._id.toString()).emit("message-deleted", {
    messageId: message._id,
    deletedPermanently: false,
    updatedMessage: message,
  });

  res.json({ deletedPermanently: false, updatedMessage: message });
};
