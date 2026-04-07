import User from "../models/user.model.js";

export const adminMiddleware = (req, res, next) => {
  try {
    const user = req.user; // coming from auth middleware

    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

export default adminMiddleware;
