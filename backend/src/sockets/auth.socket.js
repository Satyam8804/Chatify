import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export default function authSocket(io) {
  io.use(async (socket, next) => {
    try {

      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
      next(new Error("Unauthorized"));
    }
  });
}