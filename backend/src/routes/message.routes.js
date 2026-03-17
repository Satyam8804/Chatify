import {
  fetchMessageOfChat,
  sendMessage,
  markMessagesAsSeen,
  clearChat,
  sendCallMessage,
  getCallLogs,
} from "../controller/message.controller.js";

import { Router } from "express";
import protect from "../middlewares/authMiddleware.js";
import { uploadMultiple } from "../middlewares/upload.js";
import { sendMediaMessage } from "../controller/mediaMessage.controller.js";

const router = Router();

router.post("/", protect, sendMessage);
router.get("/:chatId", protect, fetchMessageOfChat);
router.post("/seen/:chatId", protect, markMessagesAsSeen);

router.post(
  "/media",
  protect,
  uploadMultiple("files", 10),
  sendMediaMessage
);

router.post("/call", protect, sendCallMessage);

router.delete("/clear/:chatId", protect, clearChat);

router.get("/calls/logs", protect, getCallLogs);

export default router;