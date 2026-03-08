import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";

export const sendMediaMessage = async (req, res) => {
  try {
    const { chatId } = req.body;
    const files = req.files;

    if (!chatId) {
      return res.status(400).json({ message: "ChatId is required" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedMedia = await Promise.all(
      files.map(async (file) => {
        const result = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          "chat-media"
        );

        return {
          url: result.secure_url,
          type: file.mimetype,
          name: file.originalname,
          size: file.size,
        };
      })
    );

    let message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      messageType: "media",
      media: uploadedMedia,
    });

    message = await message.populate("sender", "fName lName avatar");

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("MEDIA MESSAGE ERROR 👉", error);
    res.status(500).json({ message: error.message });
  }
};
