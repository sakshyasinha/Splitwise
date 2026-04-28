import express from "express";
import { createGroup, updateGroup, deleteGroup, addMember, removeMember } from "../controllers/group.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import Group from "../models/group.model.js"; 
import Expense from "../models/expense.model.js";

const router = express.Router();

const getGroupDedupKey = (group) => {
  const creator = Array.isArray(group.createdBy) ? group.createdBy[0] : group.createdBy;
  const creatorId = creator && typeof creator === "object" ? creator._id || creator.id : creator;

  return `${String(group.name || "").trim().toLowerCase()}::${String(group.type || "other").trim().toLowerCase()}::${String(creatorId || "")}`;
};

router.post("/create", protect, createGroup);

router.get("/", protect, async (req, res) => {
  try {
    const [memberOrOwnerGroups, expenseGroupIds] = await Promise.all([
      Group.find({
        $or: [
          { members: req.user.id },
          { createdBy: req.user.id },
        ],
      }).select("_id"),
      Expense.distinct("group", {
        $or: [
          { paidBy: req.user.id },
          { "participants.userId": req.user.id },
        ],
      }),
    ]);

    const visibleGroupIds = [...new Set([
      ...memberOrOwnerGroups.map((group) => String(group._id)),
      ...expenseGroupIds.map((groupId) => String(groupId)),
    ])];

    const groups = await Group.find({
      _id: { $in: visibleGroupIds },
    })
      .populate("members", "name email")
      .populate("createdBy", "name email");

    const seen = new Set();
    const uniqueGroups = groups.filter((group) => {
      const key = getGroupDedupKey(group);
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    res.json(uniqueGroups);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch groups" });
  }
});

router.put("/:id", protect, updateGroup);
router.delete("/:id", protect, deleteGroup);
router.patch("/:id/members/add", protect, addMember);
router.patch("/:id/members/remove", protect, removeMember);

export default router;