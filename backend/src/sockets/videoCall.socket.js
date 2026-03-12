export const videoCallSocket = (io, socket) => {
    
  socket.on("video-call-user", ({ chatId }) => {
    socket.to(chatId).emit("incoming-call", {
      from: socket.userId,
    });
  });

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
