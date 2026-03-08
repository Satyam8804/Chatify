import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  url: String,
  type: String,
  name: String,
  size: Number
});

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true
    },

    content: {
      type: String,
      trim: true,
      default: ""
    },

    media: {
      type: [mediaSchema],
      default: []
    },

    messageType: {
      type: String,
      enum: ["text", "media"],
      default: "text"
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);