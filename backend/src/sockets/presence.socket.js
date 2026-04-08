import User from "../models/user.model.js";

export const onlineUsers = new Map();

export default function presenceSocket(io, socket) {
  const userId = socket.userId?.toString();
  if (!userId) return;

  // ─── Add socket ─────────────────────────
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  // ✅ send current state to THIS user
  socket.emit("online-users", Array.from(onlineUsers.keys()));

  // ✅ notify others
  io.emit("user-online", { userId });

  // ─── Disconnect ─────────────────────────
  socket.on("disconnect", async () => {
    const userSockets = onlineUsers.get(userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      onlineUsers.delete(userId);

      await User.findByIdAndUpdate(userId, {
        lastSeen: new Date(),
      });

      io.emit("user-offline", { userId });
    }

    // ✅ sync everyone
    io.emit("online-users", Array.from(onlineUsers.keys()));
  });
}
