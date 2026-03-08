import Message from "../models/message.model.js";

export default function readSocket(io, socket) {

  socket.on("message-seen", async ({ chatId }) => {
    try {

      const userId = socket.userId;

      // update database
      await Message.updateMany(
        {
          chat: chatId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        {
          $addToSet: { readBy: userId },
        }
      );

      // notify other users
      socket.to(chatId).emit("message-seen", {
        chatId,
        userId
      });

    } catch (error) {
      console.log("Message seen error:", error.message);
    }

  });

}