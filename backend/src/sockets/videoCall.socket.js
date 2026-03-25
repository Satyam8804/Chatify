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
    const isInvited = call.invitedUsers
      .map(String)
      .includes(String(socket.userId));

    const alreadyJoined = call.participants
      .map(String)
      .includes(String(socket.userId));

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
    if (!chatId || !receiverIds?.length) return;

    const callerId = String(socket.userId);

    // 1. Get or create call
    let call = activeCalls.get(chatId);

    if (!call) {
      call = {
        invitedUsers: [],
        participants: [],
        callType,
      };
    }

    // 2. Normalize IDs (IMPORTANT)
    const normalizedReceivers = receiverIds.map(String);

    // 3. Add invited users (avoid duplicates)
    normalizedReceivers.forEach((id) => {
      if (!call.invitedUsers.includes(id)) {
        call.invitedUsers.push(id);
      }
    });

    // 4. Add caller to participants
    if (!call.participants.includes(callerId)) {
      call.participants = [...new Set([...call.participants, callerId])];
    }

    // 5. Update call type
    call.callType = callType;

    // 6. Save call
    activeCalls.set(chatId, call);

    console.log("📞 Active call:", call);

    // 7. Cleanup after 30 min
    setTimeout(() => {
      if (activeCalls.has(chatId)) {
        console.log("🧹 Cleaning stale call:", chatId);
        activeCalls.delete(chatId);
      }
    }, 1000 * 60 * 30);

    // 8. Send incoming-call (only online users)
    normalizedReceivers.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: callerId,
          callerName: socket.user?.fName,
          callerAvatar: socket.user?.avatar,
          chatId,
          isGroup: !!isGroup,
          callType,
        });
      });
    });

    // 9. Send ongoing-call (real-time sync)
    call.invitedUsers.forEach((userId) => {
      // skip already joined users
      if (call.participants.includes(userId)) return;

      onlineUsers.get(userId)?.forEach((socketId) => {
        console.log("📡 ongoing-call →", userId);

        io.to(socketId).emit("ongoing-call", {
          chatId,
          participants: call.participants,
          callType,
        });
      });
    });
  });

  socket.on("invite-to-call", ({ chatId, inviteeIds, callType }) => {
    if (!chatId || !inviteeIds?.length) return;

    const callerId = String(socket.userId);
    const normalizedInvitees = inviteeIds.map(String);

    let call = activeCalls.get(chatId);

    // 1. Create call if not exists
    if (!call) {
      console.log("⚠️ Creating fallback call");

      call = {
        invitedUsers: [],
        participants: [callerId],
        callType,
      };
    }

    // 2. Add invitees to invitedUsers (CRITICAL FIX)
    normalizedInvitees.forEach((id) => {
      if (!call.invitedUsers.includes(id)) {
        call.invitedUsers.push(id);
      }
    });

    // 3. Save updated call
    activeCalls.set(chatId, call);

    console.log("📞 Updated call (invite):", call);

    // 4. Send incoming-call (only online users)
    normalizedInvitees.forEach((userId) => {
      onlineUsers.get(userId)?.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          from: callerId,
          callerName: socket.user?.fName,
          callerAvatar: socket.user?.avatar,
          chatId,
          callType,
          isGroup: true,
        });
      });
    });

    // 5. Send ongoing-call (real-time sync)
    normalizedInvitees.forEach((userId) => {
      // skip users already in call
      if (call.participants.map(String).includes(userId)) return;

      onlineUsers.get(userId)?.forEach((socketId) => {
        console.log("📡 ongoing-call →", userId);

        io.to(socketId).emit("ongoing-call", {
          chatId,
          participants: call.participants,
          callType,
        });
      });
    });

    // 6. Notify existing participants
    socket.to(chatId).emit("user-invited-to-call", {
      userIds: normalizedInvitees,
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

    console.log("📥 request-ongoing-call from:", socket.userId);
    console.log("📊 activeCalls size:", activeCalls.size);

    if (activeCalls.size === 0) {
      console.log("⚠️ No active calls found");
    }

    activeCalls.forEach((call, chatId) => {
      const isInvited = call.invitedUsers
        .map(String)
        .includes(String(socket.userId));
      const alreadyJoined = call.participants
        .map(String)
        .includes(String(socket.userId));

      if (isInvited && !alreadyJoined) {
        socket.emit("ongoing-call", {
          chatId,
          participants: call.participants,
          callType: call.callType,
        });
      }
    });
  });

  socket.on("call-ended", ({ roomId, isGroup }) => {
    if (!roomId) return;

    const call = activeCalls.get(roomId);
    activeCalls.delete(roomId);

    // 🔥 1. Notify ALL participants (important)
    if (call?.participants?.length) {
      call.participants.forEach((userId) => {
        onlineUsers.get(String(userId))?.forEach((socketId) => {
          io.to(socketId).emit("call-ended", {
            chatId: roomId,
            by: socket.userId,
          });
        });
      });
    }

    if (isGroup) {
      // notify room users
      socket.to(roomId).emit("user-left-call", { userId: socket.userId });
      socket.leave(roomId);

      // 🔥 2. Notify invited users who never joined
      if (call?.invitedUsers?.length) {
        call.invitedUsers.forEach((userId) => {
          // skip users already in call
          if (call.participants.map(String).includes(String(userId))) return;

          onlineUsers.get(String(userId))?.forEach((socketId) => {
            io.to(socketId).emit("call-fully-ended", {
              chatId: roomId,
            });
          });
        });
      }
    } else {
      // 🔥 3. one-to-one call (still notify properly)
      io.in(roomId).emit("call-ended", {
        chatId: roomId,
        by: socket.userId,
      });

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
