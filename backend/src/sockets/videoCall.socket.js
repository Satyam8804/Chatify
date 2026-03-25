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

const activeCalls = new Map();

export const videoCallSocket = (io, socket) => {
  activeCalls.forEach((call, chatId) => {
    const isInvited = call.invitedUsers.includes(socket.userId);
    const alreadyJoined = call.participants.includes(socket.userId);

    if (isInvited && !alreadyJoined) {
      console.log("📞 Sending ongoing call to:", socket.userId);

      socket.emit("ongoing-call", {
        chatId,
        participants: call.participants,
        callType: call.callType,
      });
    }
  });

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
            name: s.user?.fName || "User",
            avatar: s.user?.avatar,
          });
        }
      });
    }

    if (!socket.rooms.has(roomId)) {
      socket.join(roomId);

      const call = activeCalls.get(roomId);
      if (call) {
        if (!call.participants.includes(socket.userId)) {
          call.participants.push(socket.userId);
        }
      }
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

  socket.on("ping-rejoin", ({ chatId }) => {
    if (!chatId) return;

    console.log("🔄 Rejoin broadcast:", socket.userId);

    // tell others in room to renegotiate
    socket.to(chatId).emit("peer-rejoin", {
      userId: socket.userId,
    });
  });

  socket.on("video-call-user", ({ chatId, receiverIds, isGroup, callType }) => {
    if (!receiverIds?.length) return;

    // 🔥 NEW
    activeCalls.set(chatId, {
      invitedUsers: receiverIds,
      participants: [socket.userId],
      callType,
    });

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

    receiverIds.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("ongoing-call", {
          chatId,
          participants: [socket.userId],
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
          isGroup: true, // ✅ force group
        });
      });
    });

    const call = activeCalls.get(chatId);

    if (call) {
      inviteeIds.forEach((id) => {
        if (!call.invitedUsers.includes(id)) {
          call.invitedUsers.push(id);
        }
      });
    }

    inviteeIds.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("ongoing-call", {
          chatId,
          participants: call.participants,
          callType,
        });
      });
    });

    // ✅ notify existing room users
    socket.to(chatId).emit("user-invited-to-call", {
      userIds: inviteeIds,
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

  socket.on("call-ended", ({ roomId, isGroup }) => {
    if (!roomId) return;

    const call = activeCalls.get(roomId);
    activeCalls.delete(roomId);

    if (isGroup) {
      socket.to(roomId).emit("user-left-call", { userId: socket.userId });
      socket.leave(roomId);

      // ✅ notify invited users who never joined so their banner clears
      if (call?.invitedUsers?.length) {
        call.invitedUsers.forEach((userId) => {
          if (call.participants.includes(userId)) return; // already in call, skip
          onlineUsers.get(userId)?.forEach((socketId) => {
            io.to(socketId).emit("call-fully-ended", { chatId: roomId });
          });
        });
      }
    } else {
      io.in(roomId).emit("call-ended", { by: socket.userId });
      socket.leave(roomId);
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
};
