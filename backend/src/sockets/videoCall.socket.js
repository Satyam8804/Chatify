import { onlineUsers } from "./presence.socket.js";

const routeToUser = (io, userId, roomId, event, data) => {
  if (roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      let sent = false;
      room.forEach((socketId) => {
        const s = io.sockets.sockets.get(socketId);
        if (s?.userId === userId) {
          s.emit(event, data);
          sent = true;
          console.log(`[Server] ${event} sent via room to ${userId}`);
        }
      });
      if (sent) return;
    }
  }

  const targets = onlineUsers.get(userId);
  if (targets?.size) {
    console.log(`[Server] ${event} fallback via onlineUsers to ${userId}`);
    targets.forEach((socketId) => io.to(socketId).emit(event, data));
  } else {
    console.warn(`[Server] ${event} — no socket found for ${userId}`);
  }
};

export const videoCallSocket = (io, socket) => {
  socket.on("join-call-room", ({ roomId }) => {
    if (!roomId || socket.rooms.has(roomId)) return;

    console.log(`[Server] ${socket.userId} joining room ${roomId}`);

    const existingParticipants = [];
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      room.forEach((socketId) => {
        const s = io.sockets.sockets.get(socketId);
        if (s?.userId)
          existingParticipants.push({ userId: s.userId, name: s.user?.fName });
      });
    }

    socket.join(roomId);

    socket.emit("existing-participants", {
      participants: existingParticipants,
    });
    socket.to(roomId).emit("user-joined-call", {
      userId: socket.userId,
      name: socket.user?.fName,
    });
  });

  socket.on("leave-call-room", ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    socket.to(roomId).emit("user-left-call", { userId: socket.userId });
  });

  socket.on("video-call-user", ({ chatId, receiverIds, isGroup, callType }) => {
    if (!receiverIds?.length) return;
    receiverIds.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: socket.userId,
          callerName: socket.user?.fName,
          chatId,
          isGroup: !!isGroup,
          callType,
        });
      });
    });
  });

  socket.on("invite-to-call", ({ chatId, inviteeIds }) => {
    if (!inviteeIds?.length) return;
    inviteeIds.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: socket.userId,
          callerName: socket.user?.fName,
          chatId,
          isGroup: true,
        });
      });
    });
  });

  socket.on("call-accepted", ({ to }) => {
    if (!to) return;
    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("call-accepted", { from: socket.userId });
    });
  });

  socket.on("call-rejected", ({ to }) => {
    if (!to) return;
    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("call-rejected", { from: socket.userId });
    });
  });

  socket.on("call-ended", ({ to, roomId }) => {
    if (roomId) {
      socket.to(roomId).emit("user-left-call", { userId: socket.userId });
      socket.leave(roomId);
      return;
    }
    if (to) {
      onlineUsers.get(to)?.forEach((socketId) => {
        io.to(socketId).emit("call-ended", { from: socket.userId });
      });
    }
  });

  socket.on("webrtc-offer", ({ offer, to, fromName, roomId }) => {
    if (!offer || !to) return;

    routeToUser(io, to, roomId, "webrtc-offer", {
      offer,
      from: socket.userId,
      fromName,
    });
  });

  socket.on("webrtc-answer", ({ answer, to, roomId }) => {
    if (!answer || !to) return;
    routeToUser(io, to, roomId, "webrtc-answer", {
      answer,
      from: socket.userId,
    });
  });

  socket.on("ice-candidate", ({ candidate, to, roomId }) => {
    if (!candidate || !to) return;
    routeToUser(io, to, roomId, "ice-candidate", {
      candidate,
      from: socket.userId,
    });
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomId) => {
      if (roomId === socket.id || roomId === socket.userId?.toString()) return;
      socket.to(roomId).emit("user-left-call", { userId: socket.userId });
    });
  });
};
