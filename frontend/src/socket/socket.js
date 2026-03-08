// import { io } from "socket.io-client";

// let socket;

// export const connectSocket = (token) => {

//   console.log("Connecting socket with token 👉", token);

//   if (!token) {
//     console.log("❌ No token, socket not connecting");
//     return;
//   }

//   if (socket) return socket;

//   socket = io("http://localhost:5000", {
//     auth: {
//       token,
//     },
//   });

//   return socket;
// };

// export const getSocket = () => socket;

// export const disconnectSocket = () => {
//   if (socket) {
//     socket.disconnect();
//     socket = null;
//   }
// };