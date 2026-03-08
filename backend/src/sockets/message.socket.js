export default function messageSocket(io, socket) {
  socket.on("new-message", (message) => {
    const chatId = message?.chat?._id
      ? message.chat._id.toString()
      : message?.chat?.toString();

    const users = message?.chat?.users || [];

    if (!chatId) return;

    console.log("📩 new-message received");
    console.log("ChatId:", chatId);

    // emit to active chat room
    socket.to(chatId).emit("receive-message", message);

    // send notification to users
    users.forEach((userId) => {
      const receiverId = userId.toString();

      if (receiverId !== socket.userId.toString()) {
        console.log("🔔 Emitting notification to:", receiverId);

        io.to(receiverId).emit("message-notification", {
          chatId,
          message,
        });
      }
    });
  });
}
