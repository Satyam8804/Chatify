import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import getInitials from "../utils/getInitials.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";

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
      return res.status(400).json({
        message: "User already exists",
      });
    }

    
    const hashedPwd = await bcrypt.hash(password, 10);

    let avatarUrl = "";

    
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "avatars");
      avatarUrl = result.secure_url;
    }

    const newUser = await User.create({
      fName: fName.trim(),
      lName: lName.trim(),
      email: normalizedEmail,
      password: hashedPwd,
      avatar: avatarUrl,
    });

    res.status(201).json({
      message: "User registered successfully",
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
    res.status(500).json({
      message: "Server Error",
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    console.log(password);

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid Credentials !" });
    }
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ massage: "Invalid Credentials" });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;

    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 20 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        _id: user._id,
        fName: user.fName,
        lName: user.lName,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookie.refreshToken;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ message: "Session Expired. Please login again." });
    }

    const user = await User.findOne({ refreshToken });

    if (!user) {
      return res.status(401).json({ message: "Invalid User !" });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: "Session Expired." });

      const newAccessToken = generateAccessToken(user._id);
      res.json({ accessToken: newAccessToken });
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
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

    res.json({ message: "Logged out successfully !" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed !" });
  }
};

export const meRoute = async (req, res) => {

  try {

    const user = req.user;
    // 🔥 generate fresh access token
    const accessToken = generateAccessToken(user._id);
    res.json({
      user: {
        _id: user._id,
        fName: user.fName,
        lName: user.lName,
        email: user.email,
        avatar: user.avatar,
      },
      accessToken,   // ✅ IMPORTANT
    });

  } catch (error) {

    res.status(500).json({
      message: "Server error",
    });

  }
};

export const updateMe = async (req, res) => {
  try {
    const { fName, lName } = req.body;

    const updates = {};

    // Update name fields if provided
    if (fName) updates.fName = fName.trim();
    if (lName) updates.lName = lName.trim();

    // Update avatar if provided
    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        "avatars"
      );
      updates.avatar = result.secure_url;
    }

    // If nothing to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No fields provided to update",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    );

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        fName: updatedUser.fName,
        lName: updatedUser.lName,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
      },
    });
  } catch (error) {
    console.error("UPDATE ME ERROR 👉", error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};


export const searchUsers = async (req, res) => {
  const keyword = req.query.q;

  const users = await User.find({
    $or: [
      { fName: { $regex: keyword, $options: "i" } },
      { lName: { $regex: keyword, $options: "i" } },
      { email: { $regex: keyword, $options: "i" } },
    ],
    _id: { $ne: req.user._id },
  }).select("-password");

  res.json(users);
};

