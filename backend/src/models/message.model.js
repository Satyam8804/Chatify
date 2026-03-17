import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  url: String,
  type: String,
  name: String,
  size: Number,
});

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },

    content: {
      type: String,
      trim: true,
      default: "",
    },

    media: {
      type: [mediaSchema],
      default: [],
    },

    messageType: {
      type: String,
      enum: ["text", "media", "call"], // ✅ added
      default: "text",
    },

    callData: {
      callType: {
        type: String,
        enum: ["audio", "video"],
      },
      status: {
        type: String,
        enum: ["missed", "completed", "rejected"],
      },
      duration: {
        type: Number,
        default: 0,
      },
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
