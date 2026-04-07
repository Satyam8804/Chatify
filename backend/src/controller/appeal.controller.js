// controllers/appeal.controller.js
import Appeal from "../models/appeal.model.js";
import User from "../models/user.model.js";

// User submits an appeal (no auth required — they're banned)
export const submitAppeal = async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId || !reason)
      return res.status(400).json({ message: "userId and reason are required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isBanned)
      return res.status(400).json({ message: "This account is not banned" });

    // Prevent duplicate pending appeals
    const existing = await Appeal.findOne({ user: userId, status: "pending" });
    if (existing)
      return res.status(409).json({ message: "You already have a pending appeal" });

    const appeal = await Appeal.create({ user: userId, reason ,bannedAt:Date.now });

    res.status(201).json({ message: "Appeal submitted successfully", appeal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — get all appeals
export const getAppeals = async (req, res) => {
  try {
    const { status = "pending" } = req.query;

    const appeals = await Appeal.find({ status })
      .populate("user", "fName lName email banReason bannedAt")
      .populate("reviewedBy", "fName lName")
      .sort({ createdAt: -1 });

    res.json({ appeals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — approve or reject an appeal
export const reviewAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote } = req.body; // action: "approved" | "rejected"

    if (!["approved", "rejected"].includes(action))
      return res.status(400).json({ message: "action must be approved or rejected" });

    const appeal = await Appeal.findById(id).populate("user");
    if (!appeal) return res.status(404).json({ message: "Appeal not found" });
    if (appeal.status !== "pending")
      return res.status(400).json({ message: "Appeal already reviewed" });

    appeal.status = action;
    appeal.adminNote = adminNote || "";
    appeal.reviewedBy = req.user._id;
    appeal.reviewedAt = new Date();
    await appeal.save();

    // ✅ If approved, unban the user automatically
    if (action === "approved") {
      await User.findByIdAndUpdate(appeal.user._id, {
        isBanned: false,
        banReason: "",
        bannedAt: null,
      });
    }

    res.json({ message: `Appeal ${action}`, appeal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};