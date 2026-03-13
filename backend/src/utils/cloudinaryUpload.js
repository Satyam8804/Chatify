import cloudinary from "./cloudinary.js";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const uploadToCloudinary = (
  buffer,
  fileName,
  folder = "chat-media",
  userId = null
) => {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  const isSvg = ext === "svg";

  // ✅ Always unique: userId-based for avatars, random uuid for media
  // This prevents two users uploading "avatar.jpg" from sharing a cached URL
  const uniqueName = userId
    ? `${userId}` // avatars: stable per user, updates invalidate cache
    : `${uuidv4()}`; // chat media: always a fresh file

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: uniqueName, // ✅ unique ID — no collisions
        overwrite: true, // ✅ replace old file when user updates avatar
        invalidate: true, // ✅ purge CDN cache on overwrite
        resource_type: isSvg ? "image" : "auto",
        access_mode: "public",
        ...(isSvg && { format: "svg" }),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};
