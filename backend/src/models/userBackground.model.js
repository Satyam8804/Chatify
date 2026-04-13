import mongoose from "mongoose";

const userBackgroundSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Full resolution image URL (stored in cloud)
    assetUrl: {
      type: String,
      required: true,
    },

    // Compressed preview for picker grid
    thumbnailUrl: {
      type: String,
      required: true,
    },

    // Original file name (for display in picker)
    fileName: {
      type: String,
      trim: true,
    },

    // File size in bytes (for storage limit checks)
    fileSize: {
      type: Number,
    },
  },
  { timestamps: true }
);

const UserBackground = mongoose.model("UserBackground", userBackgroundSchema);
export default UserBackground;