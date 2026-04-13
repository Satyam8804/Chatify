import mongoose from "mongoose";

const backgroundSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: ["Nature", "Abstract", "Minimal", "Dark", "Light", "Other"],
      default: "Other",
    },

    type: {
      type: String,
      enum: ["image", "gradient", "solid_color"],
      required: true,
    },

    // Full resolution background URL
    assetUrl: {
      type: String,
      required: true,
    },

    // Compressed preview for picker grid
    thumbnailUrl: {
      type: String,
      required: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    // Controls visibility to users
    isActive: {
      type: Boolean,
      default: true,
    },

    // Controls order in the picker
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Background = mongoose.model("Background", backgroundSchema);
export default Background;