export default function messageSocket(io, socket) {
  socket.on("new-message", (message) => {
    const chatId = message?.chat?._id
      ? message.chat._id.toString()
      : message?.chat?.toString();

    const users = message?.chat?.users || [];

    if (!chatId) return;

    io.to(chatId).emit("receive-message", message);

    // send notification to users
    users.forEach((userId) => {
      const receiverId = userId.toString();
      if (receiverId !== socket.userId.toString()) {
        io.to(receiverId).emit("message-notification", {
          chatId,
          message,
        });
      }
    });
  });
}
