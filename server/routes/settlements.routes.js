import express from "express";
import { getSettlement, createPayment, getSettlementHistory } from "../controllers/settlement.controller.js";
import { protect } from "../middleware/auth.middleware.js";
const router=express.Router();

// All settlement routes require authentication
router.use(protect);

// Get settlement history for current user (must be before :groupId)
router.get("/history", getSettlementHistory);

// Get suggested settlements for a group
router.get("/:groupId", getSettlement);

// Create a new payment/settlement
router.post("/", createPayment);

export default router;

