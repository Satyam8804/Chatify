import { onlineUsers } from "./presence.socket.js";

const routeToUser = (io, userId, roomId, event, data) => {
  if (roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);

    if (room && room.size > 0) {
      let sent = false;

      room.forEach((socketId) => {
        const s = io.sockets.sockets.get(socketId);
        if (s?.userId === userId) {
          s.emit(event, data);
          sent = true;
        }
      });

      if (sent) return;
    }
  }

  const targets = onlineUsers.get(userId);

  if (targets?.size) {
    targets.forEach((socketId) => {
      io.to(socketId).emit(event, data);
    });
  }
};

export const videoCallSocket = (io, socket) => {
  socket.on("join-call-room", ({ roomId }) => {
    if (!roomId) return;

    const existingParticipants = [];
    const room = io.sockets.adapter.rooms.get(roomId);

    if (room) {
      room.forEach((socketId) => {
        const s = io.sockets.sockets.get(socketId);
        if (s?.userId && s.id !== socket.id) {
          existingParticipants.push({
            userId: s.userId,
            name: s.user?.fName,
            avatar: s.user?.avatar,
          });
        }
      });
    }

    if (!socket.rooms.has(roomId)) {
      socket.join(roomId);
      socket.to(roomId).emit("user-joined-call", {
        userId: socket.userId,
        name: socket.user?.fName,
        avatar: socket.user?.avatar,
      });
    }

    socket.emit("existing-participants", {
      participants: existingParticipants,
    });
  });

  socket.on("leave-call-room", ({ roomId }) => {
    if (!roomId) return;

    socket.leave(roomId);

    socket.to(roomId).emit("user-left-call", {
      userId: socket.userId,
    });
  });

  socket.on("ping-rejoin", ({ to, chatId }) => {
    if (!to) return;
    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("ping-rejoin", {
        from: socket.userId,
        chatId,
      });
    });
  });

  socket.on("video-call-user", ({ chatId, receiverIds, isGroup, callType }) => {
    if (!receiverIds?.length) return;

    receiverIds.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: socket.userId,
          callerName: socket.user?.fName,
          callerAvatar: socket.user?.avatar,
          chatId,
          isGroup: !!isGroup,
          callType,
        });
      });
    });
  });

  socket.on("invite-to-call", ({ chatId, inviteeIds, callType }) => {
    if (!inviteeIds?.length) return;

    inviteeIds.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: socket.userId,
          callerName: socket.user?.fName,
          callerAvatar: socket.user?.avatar,
          chatId,
          callType,
          isGroup: true,
        });
      });
    });
  });

  socket.on("call-accepted", ({ to }) => {
    if (!to) return;

    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("call-accepted", {
        from: socket.userId,
      });
    });
  });

  socket.on("call-rejected", ({ to }) => {
    if (!to) return;

    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("call-rejected", {
        from: socket.userId,
      });
    });
  });

  socket.on("call-ended", ({ to, roomId }) => {
    if (roomId) {
      socket.to(roomId).emit("user-left-call", {
        userId: socket.userId,
      });

      socket.leave(roomId);
      return;
    }

    if (to) {
      onlineUsers.get(to)?.forEach((socketId) => {
        io.to(socketId).emit("call-ended", {
          from: socket.userId,
        });
      });
    }
  });

  socket.on("mute-state", ({ roomId, isMuted }) => {
    if (!roomId) return;

    socket.to(roomId).emit("user-muted", {
      userId: socket.userId,
      isMuted,
    });
  });

  socket.on("webrtc-offer", ({ offer, to, fromName, roomId }) => {
    if (!offer || !to) return;

    routeToUser(io, to, roomId, "webrtc-offer", {
      offer,
      from: socket.userId,
      fromName,
      fromAvatar: socket.user?.avatar,
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

  socket.on("leave-call-room", ({ roomId }) => {
    if (!roomId) return;

    socket.leave(roomId);

    socket.to(roomId).emit("user-left-call", {
      userId: socket.userId,
    });
  });
};
