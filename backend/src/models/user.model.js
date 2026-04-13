import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    fName: {
      type: String,
      required: true,
      trim: true,
    },
    lName: {
      type: String,
      required: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: false,
      select: false,
    },

    googleId: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "both"],
      default: "local",
    },

    avatar: {
      type: String,
      default: "",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      default: "",
    },
    lastSeen: {
      type: Date,
      default: null,
    },

    // ✅ Admin flag
    isAdmin: {
      type: Boolean,
      default: false,
    },

    // ✅ Ban support
    isBanned: {
      type: Boolean,
      default: false,
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    banReason: {
      type: String,
      default: "",
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    defaultBackground: {
      backgroundType: {
        type: String,
        enum: ["Background", "UserBackground"], // ← must match model names exactly
        default: null,
      },
      backgroundRef: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "defaultBackground.backgroundType", // dynamically refs correct model
        default: null,
      },
    },
  },

  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
