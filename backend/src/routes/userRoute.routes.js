import { Router } from "express";
import passport from "../utils/passport.js"
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  meRoute,
  logout,
  updateMe,
  searchUsers,
  googleCallback,
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

// Step 1: redirect user to Google consent screen

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// Step 2: Google redirects back here after user consents

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  googleCallback
);

export default router;
