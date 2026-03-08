import {
  fetchMessageOfChat,
  sendMessage,
  markMessagesAsSeen
} from "../controller/message.controller.js";

import { Router } from "express";
import protect from "../middlewares/authMiddleware.js";
import { uploadMultiple } from "../middlewares/upload.js";
import { sendMediaMessage } from "../controller/mediaMessage.controller.js";

const router = Router();

router.post("/", protect, sendMessage);
router.get("/:chatId", protect, fetchMessageOfChat);
router.post("/seen/:chatId",protect,markMessagesAsSeen);

router.post(
  "/media",
  protect,
  uploadMultiple("files", 10), // 👈 MUST match frontend key
  sendMediaMessage
);
export default router;
