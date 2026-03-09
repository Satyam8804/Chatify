export default function chatSocket(io, socket) {
  socket.on("join-chat", (chatId) => {
    socket.join(chatId);
  });
}
