import express from "express";
import { getSettlement } from "../controllers/settlement.controller.js";
import { protect } from "../middleware/auth.middleware.js";
const router=express.Router();

router.get("/:groupId",protect,getSettlement);

export default router;

