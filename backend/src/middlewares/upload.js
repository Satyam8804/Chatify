import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

  const allowedPrefixes = ["image/", "video/", "audio/"];

  const allowedExact = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
  ];

  const isPrefixAllowed = allowedPrefixes.some(type =>
    file.mimetype.startsWith(type)
  );

  const isExactAllowed = allowedExact.includes(file.mimetype);

  if (isPrefixAllowed || isExactAllowed) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files:10
  },
});

export const uploadSingle = (field) => upload.single(field);
export const uploadMultiple = (field, limit = 10) => upload.array(field, limit);