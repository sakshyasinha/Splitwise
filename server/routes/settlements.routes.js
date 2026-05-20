import express from "express";
import { getSettlement, createPayment, getSettlementHistory, sendPaymentReminder } from "../controllers/settlement.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import validate from "../middleware/validation.middleware.js";
import { createPaymentSchema, sendPaymentReminderSchema } from "../schemas/settlement.schema.js";

const router=express.Router();

// All settlement routes require authentication
router.use(protect);

// Get settlement history for current user (must be before :groupId)
router.get("/history", getSettlementHistory);

// Get suggested settlements for a group
router.get("/:groupId", getSettlement);

// Create a new payment/settlement
router.post("/", validate(createPaymentSchema), createPayment);

// Send a payment reminder/nudge to a borrower
router.post("/nudge", validate(sendPaymentReminderSchema), sendPaymentReminder);

export default router;

