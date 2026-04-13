import express from "express";
import multer from "multer";
import protect from "../middlewares/authMiddleware.js";
import adminMiddleware from "../middlewares/AdminMiddleware.js";

import {
  createPresetBackground,
  getAllPresetBackgrounds,
  updatePresetBackground,
  togglePresetBackground,
  deletePresetBackground,
  uploadCustomBackground,
  getMyUploadedBackgrounds,
  deleteCustomBackground,
  setDefaultBackground,
  setChatBackground,
  getBackgroundsForPicker 
} from "../controller/background.controller.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/admin",
  protect,
  adminMiddleware,
  upload.single("image"),
  createPresetBackground
);
router.get("/admin", protect, adminMiddleware, getAllPresetBackgrounds);
router.put(
  "/admin/:id",
  protect,
  adminMiddleware,
  upload.single("image"),
  updatePresetBackground
);
router.patch("/admin/:id/toggle", protect, adminMiddleware, togglePresetBackground);
router.delete("/admin/:id", protect, adminMiddleware, deletePresetBackground);

router.post("/upload", protect, upload.single("image"), uploadCustomBackground);
router.get("/my-uploads", protect, getMyUploadedBackgrounds);
router.delete("/my-uploads/:id", protect, deleteCustomBackground);

router.patch("/default", protect, setDefaultBackground);
router.patch("/chat/:chatId", protect, setChatBackground);
router.get("/picker", protect, getBackgroundsForPicker);

export default router;
