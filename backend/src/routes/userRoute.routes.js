import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  meRoute,
  logout,
  updateMe,
  searchUsers,
} from "../controller/auth.controller.js";

import { uploadSingle } from "../middlewares/upload.js";
import protect from "../middlewares/authMiddleware.js";

const router = Router();

router.post(
  "/register-user",
  uploadSingle("avatar"), // 🔥 REQUIRED
  registerUser
);
router.post("/login-user", loginUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);
router.get("/me", protect, meRoute);

router.patch(
  "/update-me",
  protect, // user must be logged in
  uploadSingle("avatar"), // avatar is OPTIONAL
  updateMe
);

router.get("/search", protect, searchUsers);

export default router;
