import { Router } from "express";
import protect from "../middlewares/authMiddleware.js";
import {
  getStats,
  getUsers,
  deleteUser,
  banUser,
  unbanUser,
  getCallAnalytics,
} from "../controller/admin.controller.js";

import adminMiddleware from "../middlewares/AdminMiddleware.js";

const router = Router();

// All admin routes require auth + isAdmin
router.use(protect, adminMiddleware);

router.get("/stats", getStats);
router.get("/users", getUsers);
router.delete("/users/:id", deleteUser);
router.patch("/users/:id/ban", banUser);
router.patch("/users/:id/unban", unbanUser);

router.get("/call-analytics", getCallAnalytics);

export default router;