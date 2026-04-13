import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import getInitials from "../utils/getInitials.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import cloudinary from "../utils/cloudinary.js"; // ✅ needed for destroy in updateMe
import jwt from "jsonwebtoken";
import Appeal from "../models/appeal.model.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";
import { getPublicIdFromUrl } from "./message.controller.js";

export const registerUser = async (req, res) => {
  try {
    const { fName, lName, email, password } = req.body;

    if (!fName || !lName || !email || !password) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const userExist = await User.findOne({ email: normalizedEmail });
    if (userExist) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPwd = await bcrypt.hash(password, 10);

    // Create user first so we have the _id for the avatar public_id
    const newUser = await User.create({
      fName: fName.trim(),
      lName: lName.trim(),
      email: normalizedEmail,
      password: hashedPwd,
      avatar: "",
    });

    if (req.file) {
      // ✅ use newUser._id so avatar URL is unique per user
      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "avatars",
        newUser._id
      );
      newUser.avatar = result.secure_url;
      await newUser.save();
    }

    res.status(201).json({
      message: "Account Created",
      user: {
        id: newUser._id,
        fName: newUser.fName,
        lName: newUser.lName,
        email: newUser.email,
        avatar: newUser.avatar,
        initials: getInitials(newUser.fName, newUser.lName),
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR 👉", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ✅ Ban check — before password verification
    if (user.isBanned) {
      const existingAppeal = await Appeal.findOne({
        user: user._id,
        status: "pending",
      });

      return res.status(403).json({
        code: "ACCOUNT_BANNED",
        message: "Your account has been banned",
        reason: user.banReason || "No reason provided",
        bannedAt: user.bannedAt,
        userId: user._id,
        hasActiveAppeal: !!existingAppeal,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        _id: user._id,
        fName: user.fName,
        lName: user.lName,
        email: user.email,
        isAdmin: user.isAdmin,
        defaultBackground: user.defaultBackground, // ← add
      },
      message: "Logged in successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Session expired" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await User.findOneAndUpdate({ refreshToken }, { refreshToken: "" });
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
};

export const meRoute = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "defaultBackground.backgroundRef",
      select: "assetUrl thumbnailUrl",
    });

    const accessToken = generateAccessToken(user._id);
    res.json({
      user: {
        _id: user._id,
        fName: user.fName,
        lName: user.lName,
        email: user.email,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        blockedUsers: user.blockedUsers ?? [],
        defaultBackground: user.defaultBackground, // ← add
      },
      accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMe = async (req, res) => {
  try {
    const { fName, lName } = req.body;
    const updates = {};

    if (fName) updates.fName = fName.trim();
    if (lName) updates.lName = lName.trim();

    if (req.file) {
      const currentUser = await User.findById(req.user._id);

      // ✅ delete old avatar from Cloudinary before uploading new one
      if (currentUser?.avatar) {
        const public_id = getPublicIdFromUrl(currentUser.avatar);
        if (public_id) {
          await cloudinary.uploader.destroy(public_id, {
            resource_type: "image",
          });
        }
      }

      // ✅ fixed: req.file.buffer and req.file.originalname
      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "avatars",
        req.user._id // ✅ unique per user — no cache collisions
      );
      updates.avatar = result.secure_url;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
    });

    res.json({
      message: "Profile updated successfully",
      user: {
        _id: updatedUser._id,
        fName: updatedUser.fName,
        lName: updatedUser.lName,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
      },
    });
  } catch (error) {
    console.error("UPDATE ME ERROR 👉", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const query = req.query.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ message: "Query is required" });
    }

    const email = query.trim().toLowerCase();

    const users = await User.find({
      _id: { $ne: req.user._id },
      email: email, // ✅ exact match only
    }).select("-password");

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const user = req.user; // set by passport

    // 🔴 ✅ BAN CHECK (same as loginUser)
    if (user.isBanned) {
      const existingAppeal = await Appeal.findOne({
        user: user._id,
        status: "pending",
      });

      const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";

      return res.redirect(
        `${frontendUrl}/auth/google/success?error=ACCOUNT_BANNED` +
          `&reason=${encodeURIComponent(
            user.banReason || "No reason provided"
          )}` +
          `&bannedAt=${user.bannedAt}` +
          `&userId=${user._id}` +
          `&hasActiveAppeal=${!!existingAppeal}`
      );
    }

    // ✅ Normal login flow
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";

    res.redirect(`${frontendUrl}/auth/google/success?token=${accessToken}`);
  } catch (error) {
    console.error("GOOGLE CALLBACK ERROR 👉", error);
    res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
  }
};

export const toggleBlock = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUser = await User.findById(req.user._id);

    if (!currentUser)
      return res.status(404).json({ message: "User not found" });

    const isBlocked = currentUser.blockedUsers.includes(userId);

    if (isBlocked) {
      currentUser.blockedUsers.pull(userId);
    } else {
      currentUser.blockedUsers.push(userId);
    }

    await currentUser.save();

    // ✅ notify the affected user in real-time
    req.io.to(userId.toString()).emit("block-status-changed", {
      byUserId: req.user._id.toString(),
      isBlocked: !isBlocked, // true = they blocked you, false = unblocked
    });

    res.json({
      isBlocked: !isBlocked,
      userId,
      blockedUsers: currentUser.blockedUsers,
      message: isBlocked ? "User unblocked" : "User blocked",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
