import { onlineUsers } from "./presence.socket.js";

export const videoCallSocket = (io, socket) => {
  // ─────────────────────────────────────────────
  // Join call room (group calls)
  // ─────────────────────────────────────────────
  socket.on("join-call-room", ({ roomId }) => {
    if (!roomId) return;

    // prevent duplicate joins
    if (socket.rooms.has(roomId)) return;

    socket.join(roomId);

    socket.to(roomId).emit("user-joined-call", {
      userId: socket.userId,
      name: socket.user?.fName,
    });
  });

  // ─────────────────────────────────────────────
  // Leave call room
  // ─────────────────────────────────────────────
  socket.on("leave-call-room", ({ roomId }) => {
    if (!roomId) return;

    socket.leave(roomId);

    socket.to(roomId).emit("user-left-call", {
      userId: socket.userId,
    });
  });

  // ─────────────────────────────────────────────
  // Ring users (start call notification)
  // ─────────────────────────────────────────────
  socket.on("video-call-user", ({ chatId, receiverIds, isGroup }) => {
    if (!receiverIds?.length) return;

    receiverIds.forEach((userId) => {
      const sockets = onlineUsers.get(userId);
      if (!sockets) return;

      sockets.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: socket.userId,
          callerName: socket.user?.fName,
          chatId,
          isGroup: !!isGroup,
        });
      });
    });
  });

  // ─────────────────────────────────────────────
  // Call accepted (1-to-1)
  // ─────────────────────────────────────────────
  socket.on("call-accepted", ({ to }) => {
    if (!to) return;

    const targetSockets = onlineUsers.get(to);

    targetSockets?.forEach((socketId) => {
      io.to(socketId).emit("call-accepted", {
        from: socket.userId,
      });
    });
  });

  // ─────────────────────────────────────────────
  // Call rejected
  // ─────────────────────────────────────────────
  socket.on("call-rejected", ({ to }) => {
    if (!to) return;

    const targetSockets = onlineUsers.get(to);

    targetSockets?.forEach((socketId) => {
      io.to(socketId).emit("call-rejected", {
        from: socket.userId,
      });
    });
  });

  // ─────────────────────────────────────────────
  // End call
  // ─────────────────────────────────────────────
  socket.on("call-ended", ({ to, roomId }) => {
    // group call
    if (roomId) {
      io.to(roomId).emit("call-ended", {
        from: socket.userId,
      });

      socket.leave(roomId);
      return;
    }

    // 1-to-1 call
    if (to) {
      const targetSockets = onlineUsers.get(to);

      targetSockets?.forEach((socketId) => {
        io.to(socketId).emit("call-ended", {
          from: socket.userId,
        });
      });
    }
  });

  // ─────────────────────────────────────────────
  // WebRTC signaling
  // ─────────────────────────────────────────────

  socket.on("webrtc-offer", ({ offer, to, fromName }) => {
    if (!offer || !to) return;

    const targetSockets = onlineUsers.get(to);

    targetSockets?.forEach((socketId) => {
      io.to(socketId).emit("webrtc-offer", {
        offer,
        from: socket.userId,
        fromName,
      });
    });
  });

  socket.on("webrtc-answer", ({ answer, to }) => {
    if (!answer || !to) return;

    const targetSockets = onlineUsers.get(to);

    targetSockets?.forEach((socketId) => {
      io.to(socketId).emit("webrtc-answer", {
        answer,
        from: socket.userId,
      });
    });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    if (!candidate || !to) return;

    const targetSockets = onlineUsers.get(to);

    targetSockets?.forEach((socketId) => {
      io.to(socketId).emit("ice-candidate", {
        candidate,
        from: socket.userId,
      });
    });
  });

  // ─────────────────────────────────────────────
  // Cleanup when socket disconnects
  // ─────────────────────────────────────────────
  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomId) => {
      // skip private socket room
      if (roomId === socket.id) return;

      socket.to(roomId).emit("user-left-call", {
        userId: socket.userId,
      });
    });
  });
};
