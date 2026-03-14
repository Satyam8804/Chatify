import { onlineUsers } from "./presence.socket.js";

export const videoCallSocket = (io, socket) => {
  socket.on("join-call-room", ({ roomId }) => {
    if (!roomId || socket.rooms.has(roomId)) return;

    // ✅ collect BEFORE joining so self isn't included
    const existingParticipants = [];
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      room.forEach((socketId) => {
        const s = io.sockets.sockets.get(socketId);
        if (s?.userId)
          existingParticipants.push({ userId: s.userId, name: s.user?.fName });
      });
    }

    socket.join(roomId); // ✅ join AFTER collecting

    socket.emit("existing-participants", {
      participants: existingParticipants,
    });
    socket
      .to(roomId)
      .emit("user-joined-call", {
        userId: socket.userId,
        name: socket.user?.fName,
      });
  });
  socket.on("leave-call-room", ({ roomId }) => {
    if (roomId) {
      socket.leave(roomId);
      socket.to(roomId).emit("user-left-call", { userId: socket.userId });
      return;
    }
  });

  socket.on("video-call-user", ({ chatId, receiverIds, isGroup }) => {
    if (!receiverIds?.length) return;
    receiverIds.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: socket.userId,
          callerName: socket.user?.fName,
          chatId,
          isGroup: !!isGroup,
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
          isGroup: true, // ✅ upgrade to group
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

  socket.on("webrtc-offer", ({ offer, to, fromName }) => {
    if (!offer || !to) return;
    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("webrtc-offer", {
        offer,
        from: socket.userId,
        fromName,
      });
    });
  });

  socket.on("webrtc-answer", ({ answer, to }) => {
    if (!answer || !to) return;
    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("webrtc-answer", { answer, from: socket.userId });
    });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    if (!candidate || !to) return;
    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("ice-candidate", { candidate, from: socket.userId });
    });
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomId) => {
      if (roomId === socket.id) return;
      socket.to(roomId).emit("user-left-call", { userId: socket.userId });
    });
  });
};
