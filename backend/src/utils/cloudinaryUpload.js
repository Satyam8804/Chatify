import cloudinary from "./cloudinary.js";
import path from "path";

export const uploadToCloudinary = (buffer, fileName, folder = "chat-media") => {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  const isSvg = ext === "svg";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: isSvg ? "image" : "auto", // ✅ SVG must be "image"
        use_filename: true,
        unique_filename: false,
        access_mode: "public",
        ...(isSvg && { format: "svg" }), // ✅ keep SVG format
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};
