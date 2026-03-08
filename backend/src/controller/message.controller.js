import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";

export const sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;

    if (!chatId || !content) {
      return res
        .status(400)
        .json({ message: "chatId and content are required !" });
    }

    let message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      content,
      readBy: [req.user._id], 
    });

    message = await message.populate("sender", "fName lName email avatar");

    message = await message.populate("chat");

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
    });

    // ✅ send actual message object
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const fetchMessageOfChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const message = await Message.find({ chat: chatId })
      .populate("sender", "fName lName email avatar")
      .sort({ createdAt: 1 });

    res.json(message);
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
      {
        $addToSet: { readBy: userId },
      }
    );

    res.json({
      message: "Messages marked as seen",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};