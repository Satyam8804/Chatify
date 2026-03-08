export default function typingSocket(io, socket) {
  socket.on("typing", ({ chatId }) => {
    socket.to(chatId).emit("typing", {
      chatId,
      user: {
        _id: socket.userId,
        fName: socket.user?.fName,
        lName: socket.user?.lName,
        avatar: socket.user?.avatar
      }
    });
  });

  socket.on("stop-typing", ({ chatId }) => {
    socket.to(chatId).emit("stop-typing", {
      chatId,
      userId: socket.userId
    });
  });

}