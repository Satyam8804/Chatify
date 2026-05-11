import User from "../models/user.model.js";
import OTP from "../models/otp.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import getInitials from "../utils/getInitials.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import cloudinary from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import Appeal from "../models/appeal.model.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";
import { getPublicIdFromUrl } from "./message.controller.js";
import { sendOtpEmail } from "../utils/sendOtpEmail.js";

const generateOtp = () => String(crypto.randomInt(100000, 999999));

const MAX_OTP_ATTEMPTS = 5;

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Block if email is already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Rate-limit: allow max 1 OTP request per minute per email
    const recentOtp = await OTP.findOne({ email: normalizedEmail });
    if (recentOtp) {
      const secondsSinceCreated =
        (Date.now() - new Date(recentOtp.createdAt).getTime()) / 1000;

      if (secondsSinceCreated < 60) {
        return res.status(429).json({
          message: `Please wait ${Math.ceil(
            60 - secondsSinceCreated
          )}s before requesting a new code`,
        });
      }

      // Delete the old OTP so we can create a fresh one
      await OTP.deleteOne({ email: normalizedEmail });
    }

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await OTP.create({ email: normalizedEmail, otp: hashedOtp });

    await sendOtpEmail(normalizedEmail, otp);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("SEND OTP ERROR 👉", error);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { fName, lName, email, password, otp } = req.body;

    if (!fName || !lName || !email || !password || !otp) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── 1. Verify OTP ──────────────────────────────────────────────
    const otpRecord = await OTP.findOne({ email: normalizedEmail });

    if (!otpRecord) {
      return res.status(400).json({
        message: "OTP expired or not found. Please request a new one.",
      });
    }

    // Brute-force guard
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ email: normalizedEmail });
      return res.status(400).json({
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);

    if (!isOtpValid) {
      // Increment failed attempts
      await OTP.updateOne(
        { email: normalizedEmail },
        { $inc: { attempts: 1 } }
      );

      const remaining = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
      return res.status(400).json({
        message: `Invalid OTP. ${remaining} attempt${
          remaining !== 1 ? "s" : ""
        } remaining.`,
      });
    }

    // OTP is valid — delete it immediately (one-time use)
    await OTP.deleteOne({ email: normalizedEmail });

    // ── 2. Check duplicate email ────────────────────────────────────
    const userExist = await User.findOne({ email: normalizedEmail });
    if (userExist) {
      return res.status(400).json({ message: "User already exists" });
    }

    // ── 3. Create user ──────────────────────────────────────────────
    const hashedPwd = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fName: fName.trim(),
      lName: lName.trim(),
      email: normalizedEmail,
      password: hashedPwd,
      avatar: "",
    });

    if (req.file) {
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

    if (!user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
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
        defaultBackground: user.defaultBackground,
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
    const user = await User.findById(req.user._id)
    .select("+password") 
    .populate({
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
        hasPassword: !!user.password,
        blockedUsers: user.blockedUsers ?? [],
        defaultBackground: user.defaultBackground,
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

      if (currentUser?.avatar) {
        const public_id = getPublicIdFromUrl(currentUser.avatar);
        if (public_id) {
          await cloudinary.uploader.destroy(public_id, {
            resource_type: "image",
          });
        }
      }

      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "avatars",
        req.user._id
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
      email: email,
    }).select("-password");

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const user = req.user;

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

    req.io.to(userId.toString()).emit("block-status-changed", {
      byUserId: req.user._id.toString(),
      isBlocked: !isBlocked,
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

export const sendSetPasswordOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

  
    const email = user.email;

    const recentOtp = await OTP.findOne({ email });
    if (recentOtp) {
      const secondsSince = (Date.now() - new Date(recentOtp.createdAt).getTime()) / 1000;
      if (secondsSince < 60) {
        const wait = Math.ceil(60 - secondsSince);
        return res.status(429).json({
          message: `Please wait ${wait}s before requesting a new code`,
        });
      }
      await OTP.deleteOne({ email });
    }

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    await OTP.create({ email, otp: hashedOtp });

    await sendOtpEmail(email, otp);


    res.status(200).json({ message: "Verification code sent to your email" });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

export const setPassword = async (req, res) => {
  try {
    const { otp, password } = req.body;

    if (!otp || !password) {
      return res.status(400).json({ message: "OTP and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });


    // ── Verify OTP ─────────────────────────────────────────────────
    const otpRecord = await OTP.findOne({ email: user.email });

    if (!otpRecord) {
      return res.status(400).json({
        message: "OTP expired or not found. Please request a new one.",
      });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ email: user.email });
      return res.status(400).json({
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isOtpValid) {
      await OTP.updateOne({ email: user.email }, { $inc: { attempts: 1 } });
      const remaining = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
      return res.status(400).json({
        message: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
    }

    // OTP valid — delete immediately
    await OTP.deleteOne({ email: user.email });

    // ── Hash and save password ──────────────────────────────────────
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.status(200).json({ message: "Password set successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
