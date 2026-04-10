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
    isFavourite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
