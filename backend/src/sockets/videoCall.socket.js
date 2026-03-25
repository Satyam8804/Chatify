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
          call.participants = Array.from(
            new Set([...call.participants, socket.userId])
          );
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

    // ✅ Get existing call OR create new
    let call = activeCalls.get(chatId);

    if (!call) {
      call = {
        invitedUsers: [],
        participants: [],
        callType,
      };
    }

    // ✅ Add all invited users (even if offline)
    receiverIds.forEach((id) => {
      if (!call.invitedUsers.includes(id)) {
        call.invitedUsers.push(id);
      }
    });

    // ✅ Add caller to participants
    if (!call.participants.includes(socket.userId)) {
      call.participants = Array.from(
        new Set([...call.participants, socket.userId])
      );
    }

    // ✅ Update callType
    call.callType = callType;

    // ✅ Save back
    activeCalls.set(chatId, call);

    console.log("📞 Active call updated:", call);

    setTimeout(() => {
      if (!activeCalls.has(chatId)) return;

      console.log("🧹 Cleaning stale call:", chatId);
      activeCalls.delete(chatId);
    }, 1000 * 60 * 30); // 30 min

    // 🔔 Send incoming-call (only for online users)
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

    // 🔥 ALWAYS sync ongoing-call to ALL invited users
    call.invitedUsers.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        console.log("📡 Sending ongoing-call to:", userId);

        io.to(socketId).emit("ongoing-call", {
          chatId,
          participants: call.participants,
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

    let call = activeCalls.get(chatId);

    if (!call) {
      console.log("⚠️ invite-to-call without active call, creating fallback");

      call = {
        invitedUsers: [],
        participants: [socket.userId],
        callType,
      };

      activeCalls.set(chatId, call);

      call.invitedUsers.forEach((userId) => {
        onlineUsers.get(userId)?.forEach((socketId) => {
          io.to(socketId).emit("ongoing-call", {
            chatId,
            participants: call.participants,
            callType: call.callType,
          });
        });
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

  socket.on("call-rejected", ({ to, chatId }) => {
    if (!to) return;

    onlineUsers.get(to)?.forEach((socketId) => {
      io.to(socketId).emit("call-rejected", {
        from: socket.userId,
        chatId,
      });
    });
  });

  socket.on("request-ongoing-call", () => {
    if (!socket.userId) return;

    activeCalls.forEach((call, chatId) => {
      const isInvited = call.invitedUsers.includes(socket.userId);
      const alreadyJoined = call.participants.includes(socket.userId);

      if (isInvited && !alreadyJoined) {
        socket.emit("ongoing-call", {
          chatId,
          participants: call.participants,
          callType: call.callType,
        });
      }
      if (activeCalls.size === 0) {
        console.log("⚠️ No active calls found");
      }
      console.log("📥 request-ongoing-call from:", socket.userId);
      console.log("📊 activeCalls size:", activeCalls.size);
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
