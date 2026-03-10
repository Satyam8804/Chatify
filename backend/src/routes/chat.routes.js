import { Router } from "express";
import { accessChat, fetchAllChat , createGroupChat,addToGroup,removeFromGroup } from "../controller/chat.controller.js";
import protect from "../middlewares/authMiddleware.js";

const router = Router();


router.get('/',protect,fetchAllChat);
router.post('/',protect,accessChat);
router.post('/group',protect,createGroupChat);
router.patch("/group/add", protect, addToGroup);
router.patch("/group/remove", protect, removeFromGroup);

export default router;