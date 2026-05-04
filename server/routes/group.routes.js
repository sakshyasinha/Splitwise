import express from "express";
import { createGroup, updateGroup, deleteGroup, addMember, removeMember, getGroupBalance } from "../controllers/group.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import Group from "../models/group.model.js";
import Expense from "../models/expense.model.js";

const router = express.Router();

const getGroupDedupKey = (group) => {
  const creator = Array.isArray(group.createdBy) ? group.createdBy[0] : group.createdBy;
  const creatorId = creator && typeof creator === "object" ? creator._id || creator.id : creator;

  return `${String(group.name || "").trim().toLowerCase()}::${String(creatorId || "")}`;
};

router.post("/create", protect, createGroup);

router.get("/", protect, async (req, res) => {
  try {
    console.log('=== FETCHING GROUPS ===');
    console.log('User ID:', req.user.id);
    console.log('User:', req.user);

    console.log('Step 1: Finding member/owner groups...');
    const memberOrOwnerGroups = await Group.find({
      $or: [
        { members: req.user.id },
        { createdBy: req.user.id },
      ],
    }).select("_id");

    console.log('Found member/owner groups:', memberOrOwnerGroups.length);

    console.log('Step 2: Finding expense group IDs...');
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
      console.log('Found expense group IDs:', expenseGroupIds.length);
    } catch (expenseError) {
      console.error('Error in Expense.distinct:', expenseError);
      expenseGroupIds = [];
    }

    const visibleGroupIds = [...new Set([
      ...memberOrOwnerGroups.map((group) => String(group._id)),
      ...expenseGroupIds.map((groupId) => String(groupId)),
    ])];

    console.log('Visible group IDs:', visibleGroupIds);

    console.log('Step 3: Finding groups by IDs...');
    const groups = await Group.find({
      _id: { $in: visibleGroupIds },
      archived: { $ne: true }
    })
      .populate("members", "name email")
      .populate("createdBy", "name email");

    console.log('Found groups:', groups.length);
    console.log('Groups data:', JSON.stringify(groups, null, 2));

    const seen = new Set();
    const uniqueGroups = groups.filter((group) => {
      const key = getGroupDedupKey(group);
      if (seen.has(key)) {
        console.log('Duplicate group filtered:', key);
        return false;
      }

      seen.add(key);
      return true;
    });

    console.log('Unique groups:', uniqueGroups.length);
    console.log('=== END FETCHING GROUPS ===');

    res.json(uniqueGroups);
  } catch (err) {
    console.error('=== ERROR FETCHING GROUPS ===');
    console.error('Error:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('=== END ERROR ===');
    res.status(500).json({ message: "Failed to fetch groups", error: err.message });
  }
});

router.put("/:id", protect, updateGroup);
router.delete("/:id", protect, deleteGroup);
router.patch("/:id/members/add", protect, addMember);
router.patch("/:id/members/remove", protect, removeMember);
router.get("/:id/balance", protect, getGroupBalance);

export default router;