// routes/appeal.routes.js
import express from "express";
import adminMiddleware from "../middlewares/AdminMiddleware.js";
import {
  getAppeals,
  reviewAppeal,
  submitAppeal,
} from "../controller/appeal.controller.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", submitAppeal); 
router.get("/", protect, adminMiddleware, getAppeals);
router.patch("/:id", protect, adminMiddleware, reviewAppeal);

export default router;
