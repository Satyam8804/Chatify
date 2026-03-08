import User from "../models/user.model.js";

const onlineUsers = new Map();

export default function presenceSocket(io, socket) {
  const userId = socket.userId?.toString();

  if (!userId) return;

  // Join personal room
  socket.join(userId);

  // Track multiple tabs
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  // Emit updated online list
  io.emit("online-users", Array.from(onlineUsers.keys()));

  socket.on("disconnect", async () => {
    const userSockets = onlineUsers.get(userId);

    if (userSockets) {
      userSockets.delete(socket.id);

      if (userSockets.size === 0) {
        onlineUsers.delete(userId);

        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { lastSeen });
      }
    }

    io.emit("online-users", Array.from(onlineUsers.keys()));
  });
}