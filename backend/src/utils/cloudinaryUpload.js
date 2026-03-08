import cloudinary from "./cloudinary.js";

export const uploadToCloudinary = (buffer, fileName, folder = "chat-media") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: false,
        access_mode:"public"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};
