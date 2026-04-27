import express from "express";
import { createGroup } from "../controllers/group.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import Group from "../models/group.model.js"; // 👈 IMPORTANT

const router = express.Router();

// ✅ Create group
router.post("/create", protect, createGroup);

// ✅ Fetch all groups
router.get("/", protect, async (req, res) => {
  try {
    const groups = await Group.find({
      members: req.user.id, // user must be in group
    });

    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch groups" });
  }
});

export default router;