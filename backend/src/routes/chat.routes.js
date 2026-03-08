import { Router } from "express";
import { accessChat, fetchAllChat , createGroupChat } from "../controller/chat.controller.js";
import protect from "../middlewares/authMiddleware.js";
const router = Router();


router.get('/',protect,fetchAllChat);
router.post('/',protect,accessChat);
router.post('/group',protect,createGroupChat);

export default router;