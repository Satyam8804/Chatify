import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import passport from "../src/utils/passport.js";
import connectDB from "./configs/db.js";
import userRoute from "./routes/userRoute.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import messageRoutes from "./routes/message.routes.js";
import setupSocket from "./sockets/index.js";
import path from "path";

const __dirname = path.resolve();

dotenv.config();
connectDB();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize()); // ✅ initialize passport (no sessions — we use JWT)

app.get("/", (req, res) => {
  res.send("Chatify API running");
});

app.use("/api/users", userRoute);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.engine.on("connection_error", (err) => {
  console.log("Engine error:", err.message);
});

setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
