import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export default function authSocket(io) {
  io.use(async (socket, next) => {
    try {

      const token = socket.handshake.auth?.token;

      if (!token) {
        console.log("❌ No token in handshake");
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 🔥 Fetch user from DB
      const user = await User.findById(decoded.id).select(
        "_id fName lName avatar"
      );

      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach user info to socket
      socket.userId = user._id;
      socket.user = user;


      next();
    } catch (error) {
      console.log("❌ Socket auth error:", error.message);
      next(new Error("Unauthorized"));
    }
  });
}