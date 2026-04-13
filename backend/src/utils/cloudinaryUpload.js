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

  const uniqueName = userId ? `${userId}_${uuidv4()}` : `${uuidv4()}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: uniqueName,
        overwrite: true,
        invalidate: true,
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

export const uploadPresetBackground = async (buffer, fileName) => {
  const result = await uploadToCloudinary(
    buffer,
    fileName,
    "chat-backgrounds/presets"
  );

  return {
    assetUrl: result.secure_url,
    thumbnailUrl: result.secure_url.replace(
      "/upload/",
      "/upload/w_400,h_300,c_fill/"
    ),
  };
};

export const uploadUserBackground = async (buffer, fileName, userId) => {
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("Background image must be under 5MB");
  }

  const result = await uploadToCloudinary(
    buffer,
    fileName,
    "chat-backgrounds/users",
    userId
  );

  return {
    assetUrl: result.secure_url,
    thumbnailUrl: result.secure_url.replace(
      "/upload/",
      "/upload/w_400,h_300,c_fill/"
    ),
    fileSize: buffer.length,
    fileName,
  };
};
