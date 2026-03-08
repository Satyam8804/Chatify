export default function chatSocket(io, socket) {
  socket.on("join-chat", (chatId) => {
    console.log("📥 join-chat received:", chatId);
    socket.join(chatId);
    console.log("👤", socket.userId, "joined room", chatId);
  });
}
