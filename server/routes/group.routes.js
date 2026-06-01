import express from "express";
import { createGroup, updateGroup, deleteGroup, addMember, removeMember, getGroupBalance } from "../controllers/group.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import validate from "../middleware/validation.middleware.js";
import { createGroupSchema, updateGroupSchema, addGroupMemberSchema, removeGroupMemberSchema } from "../schemas/group.schema.js";
import Group from "../models/group.model.js";
import Expense from "../models/expense.model.js";
import logger from "../utils/logger.js";

const router = express.Router();

const getGroupDedupKey = (group) => {
  const creator = Array.isArray(group.createdBy) ? group.createdBy[0] : group.createdBy;
  const creatorId = creator && typeof creator === "object" ? creator._id || creator.id : creator;

  return `${String(group.name || "").trim().toLowerCase()}::${String(creatorId || "")}`;
};

router.post("/create", protect, validate(createGroupSchema), createGroup);

router.get("/", protect, async (req, res) => {
  try {
    const memberOrOwnerGroups = await Group.find({
      $or: [
        { members: req.user.id },
        { createdBy: req.user.id },
      ],
    }).select("_id");

    let expenseGroupIds = [];
    try {
      const allGroupIds = await Expense.distinct("group", {
        $or: [
          { paidBy: req.user.id },
          { "participants.userId": req.user.id },
        ],
        isDeleted: false
      });
      // Filter out null values - some expenses don't have groups (quick expenses)
      expenseGroupIds = allGroupIds.filter(id => id !== null && id !== 'null');
    } catch (expenseError) {
      logger.warn(`Failed to resolve expense groups for user ${req.user.id}: ${expenseError.message}`);
      expenseGroupIds = [];
    }

    const visibleGroupIds = [...new Set([
      ...memberOrOwnerGroups.map((group) => String(group._id)),
      ...expenseGroupIds.map((groupId) => String(groupId)),
    ])];

    const groups = await Group.find({
      _id: { $in: visibleGroupIds },
      archived: { $ne: true }
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

    logger.debug(`Fetched ${uniqueGroups.length} visible groups for user ${req.user.id}`);

    res.json(uniqueGroups);
  } catch (err) {
    logger.error(`Failed to fetch groups for user ${req.user?.id}: ${err.stack || err.message}`);
    res.status(500).json({ message: "Failed to fetch groups", error: err.message });
  }
});

router.put("/:id", protect, validate(updateGroupSchema), updateGroup);
router.delete("/:id", protect, deleteGroup);
router.patch("/:id/members/add", protect, validate(addGroupMemberSchema), addMember);
router.patch("/:id/members/remove", protect, validate(removeGroupMemberSchema), removeMember);
router.get("/:id/balance", protect, getGroupBalance);

export default router;
