import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    chatName: {
      type: String,
      trim: true,
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isFavourite: {
      type: Boolean,
      default: false,
    },
    isPinned: { type: Boolean, default: false },

    backgroundOverride: {
      backgroundType: {
        type: String,
        enum: ["Background", "UserBackground"], // ← must match model names exactly
        default: null,
      },
      backgroundRef: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "backgroundOverride.backgroundType",
        default: null,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
