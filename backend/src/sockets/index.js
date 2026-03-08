import authSocket from "./auth.socket.js";
import presenceSocket from "./presence.socket.js";
import chatSocket from "./chat.socket.js";
import typingSocket from "./typing.socket.js";
import messageSocket from "./message.socket.js";
import readSocket from "./read.socket.js";

export default function setupSocket(io) {
  // auth middleware
  
  authSocket(io);

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.userId);

    presenceSocket(io, socket);
    chatSocket(io, socket);
    typingSocket(io, socket);
    messageSocket(io, socket);
    readSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.userId);
    });
  });
}
