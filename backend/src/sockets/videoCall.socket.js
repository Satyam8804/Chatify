import { onlineUsers } from "./presence.socket";

export const videoCallSocket = (io, socket) => {
  // Caller triggers call
  socket.on("video-call-user", ({ receiverId }) => {
    const receiverSockets = onlineUsers.get(receiverId);

    if (!receiverSockets) return;

    receiverSockets.forEach((socketId) => {
      io.to(socketId).emit("incoming-call", {
        from: socket.userId,
        callerName: socket.user?.fName,
      });
    });
  });

  // Receiver accepted
  socket.on("call-accepted", ({ to }) => {
    io.to(to).emit("call-accepted");
  });

  // Receiver rejected
  socket.on("call-rejected", ({ to }) => {
    io.to(to).emit("call-rejected");
  });

  // Any user ended call
  socket.on("call-ended", ({ to }) => {
    io.to(to).emit("call-ended");
  });

  // WebRTC signaling
  socket.on("webrtc-offer", ({ offer, to }) => {
    io.to(to).emit("webrtc-offer", {
      offer,
      from: socket.userId,
    });
  });

  socket.on("webrtc-answer", ({ answer, to }) => {
    io.to(to).emit("webrtc-answer", {
      answer,
      from: socket.userId,
    });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", {
      candidate,
      from: socket.userId,
    });
  });
};
