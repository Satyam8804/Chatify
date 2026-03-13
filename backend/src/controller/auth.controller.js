import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import getInitials from "../utils/getInitials.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import cloudinary from "../utils/cloudinary.js"; // ✅ needed for destroy in updateMe
import jwt from "jsonwebtoken";

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
    const user = req.user;
    const accessToken = generateAccessToken(user._id);
    res.json({
      user: {
        _id: user._id,
        fName: user.fName,
        lName: user.lName,
        email: user.email,
        avatar: user.avatar,
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

    const q = query.trim();

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { fName: { $regex: q, $options: "i" } },
        { lName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    }).select("-password");

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
