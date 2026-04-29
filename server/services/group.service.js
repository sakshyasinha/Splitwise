import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Expense from "../models/expense.model.js";
import mongoose from "mongoose";

const ALLOWED_GROUP_TYPES = new Set(["trip", "home", "couple", "office", "friends", "other"]);

const normalizeGroupType = (value) => {
  const nextType = String(value || "other").trim().toLowerCase();
  return ALLOWED_GROUP_TYPES.has(nextType) ? nextType : "other";
};

const resolveMemberUsers = async (members = []) => {
  const cleaned = [...new Set((members || []).map((item) => String(item).trim()).filter(Boolean))];
  const users = [];
  const missing = [];

  for (const identifier of cleaned) {
    let user = null;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      user = await User.findById(identifier);
    }

    if (!user) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    }

    if (user) {
      users.push(user);
    } else {
      missing.push(identifier);
    }
  }

  if (missing.length > 0) {
    const error = new Error(`Users not found for: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  return users;
};

export const createGroup = async ({ name, type, description = "", userId, members = [] }) => {
  if (!name) {
    const error = new Error("Group name is required");
    error.statusCode = 400;
    throw error;
  }

  if (!userId) {
    const error = new Error("User is required to create a group");
    error.statusCode = 400;
    throw error;
  }

  const trimmedName = name.trim();
  const normalizedType = normalizeGroupType(type);
  const trimmedDescription = description.trim();
  const resolvedMembers = await resolveMemberUsers(members);
  const normalizedMembers = [...new Set([String(userId), ...resolvedMembers.map((user) => String(user._id))])];

  // Check for existing groups with the same name by the same user
  const existingGroups = await Group.find({
    name: trimmedName,
    createdBy: userId,
    archived: { $ne: true }
  });

  if (existingGroups.length > 0) {
    // Return existing group with a warning flag
    const existingGroup = existingGroups[0];
    existingGroup.warning = `A group named "${trimmedName}" already exists.`;
    existingGroup.isExisting = true;
    return existingGroup;
  }

  return await Group.create({
    name: trimmedName,
    description: trimmedDescription,
    type: normalizedType,
    members: normalizedMembers,
    createdBy: [userId],
  });
};

export const getGroups = async (userId) => {
  if (!userId) {
    const error = new Error("User is required");
    error.statusCode = 400;
    throw error;
  }

  const groups = await Group.find({
    $or: [
      { createdBy: userId },
      { members: userId }
    ],
    archived: { $ne: true }
  }).populate("members", "name email").populate("createdBy", "name email");

  return groups;
};

export const updateGroup = async (groupId, userId, { name, type, description }) => {
  if (!groupId) {
    const error = new Error("Group ID is required");
    error.statusCode = 400;
    throw error;
  }

  const group = await Group.findById(groupId);

  if (!group) {
    const error = new Error("Group not found");
    error.statusCode = 404;
    throw error;
  }

  // Check if user is creator
  if (!group.createdBy.some(id => String(id) === String(userId))) {
    const error = new Error("Only group creator can edit");
    error.statusCode = 403;
    throw error;
  }

  if (name) group.name = name.trim();
  if (type) group.type = normalizeGroupType(type);
  if (description !== undefined) group.description = description.trim();

  await group.save();
  return group;
};

export const deleteGroup = async (groupId, userId) => {
  try {
    if (!groupId) {
      const error = new Error("Group ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!userId) {
      const error = new Error("User ID is required");
      error.statusCode = 400;
      throw error;
    }

    const group = await Group.findById(groupId);

    if (!group) {
      const error = new Error("Group not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if user is creator
    if (!group.createdBy.some(id => String(id) === String(userId))) {
      const error = new Error("Only group creator can delete");
      error.statusCode = 403;
      throw error;
    }

    // Delete all expenses associated with this group
    await Expense.deleteMany({ group: groupId });

    // Archive the group
    group.archived = true;
    await group.save();

    return { message: 'Group and all associated expenses deleted successfully' };
  } catch (error) {
    console.error('Error in deleteGroup:', error);
    throw error;
  }
};

export const addMember = async (groupId, userId, memberId) => {
  try {
    if (!groupId || !memberId) {
      const error = new Error("Group ID and Member ID are required");
      error.statusCode = 400;
      throw error;
    }

    const group = await Group.findById(groupId);

    if (!group) {
      const error = new Error("Group not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if user is creator
    if (!group.createdBy.some(id => String(id) === String(userId))) {
      const error = new Error("Only group creator can add members");
      error.statusCode = 403;
      throw error;
    }

    // Resolve member ID (could be email or ObjectId)
    let resolvedMemberId;
    if (mongoose.Types.ObjectId.isValid(memberId)) {
      const user = await User.findById(memberId);
      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }
      resolvedMemberId = user._id;
    } else {
      // Try to find by email
      const user = await User.findOne({ email: memberId.toLowerCase() });
      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }
      resolvedMemberId = user._id;
    }

    const memberIdStr = String(resolvedMemberId);
    if (!group.members.some(id => String(id) === memberIdStr)) {
      group.members.push(resolvedMemberId);
      await group.save();
    }

    return group;
  } catch (error) {
    console.error('Error in addMember:', error);
    throw error;
  }
};

export const removeMember = async (groupId, userId, memberId) => {
  try {
    if (!groupId || !memberId) {
      const error = new Error("Group ID and Member ID are required");
      error.statusCode = 400;
      throw error;
    }

    const group = await Group.findById(groupId);

    if (!group) {
      const error = new Error("Group not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if user is creator
    if (!group.createdBy.some(id => String(id) === String(userId))) {
      const error = new Error("Only group creator can remove members");
      error.statusCode = 403;
      throw error;
    }

    // Resolve member ID (could be email or ObjectId)
    let resolvedMemberId;
    if (mongoose.Types.ObjectId.isValid(memberId)) {
      resolvedMemberId = memberId;
    } else {
      // Try to find by email
      const user = await User.findOne({ email: memberId.toLowerCase() });
      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }
      resolvedMemberId = user._id;
    }

    const memberIdStr = String(resolvedMemberId);
    group.members = group.members.filter(id => String(id) !== memberIdStr);
    await group.save();

    return group;
  } catch (error) {
    console.error('Error in removeMember:', error);
    throw error;
  }
};

/**
 * Calculate group balance and total spend
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Object containing total spend and member balances
 */
export const getGroupBalance = async (groupId) => {
  try {
    if (!groupId) {
      const error = new Error("Group ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Get all expenses for the group
    const expenses = await Expense.find({
      group: groupId,
      isDeleted: false
    }).populate('payers.userId', '_id name email')
      .populate('participants.userId', '_id name email')
      .populate('paidBy', '_id name email')
      .populate('createdBy', '_id name email');

    // Calculate total spend
    const totalSpend = expenses.reduce((sum, expense) => {
      const amount = Number(expense.amount) || 0;
      return sum + amount;
    }, 0);

    // Calculate member balances
    const memberBalances = new Map();

    expenses.forEach(expense => {
      const expenseAmount = Number(expense.amount) || 0;

      // Process payers (people who paid)
      if (expense.payers && expense.payers.length > 0) {
        expense.payers.forEach(payer => {
          const userId = String(payer.userId);
          const paidAmount = Number(payer.amount) || 0;
          if (!memberBalances.has(userId)) {
            memberBalances.set(userId, {
              userId,
              paid: 0,
              owes: 0,
              balance: 0
            });
          }
          const balance = memberBalances.get(userId);
          balance.paid += paidAmount;
          balance.balance += paidAmount;
        });
      } else if (expense.paidBy) {
        // Legacy support for single payer
        const userId = String(expense.paidBy);
        if (!memberBalances.has(userId)) {
          memberBalances.set(userId, {
            userId,
            paid: 0,
            owes: 0,
            balance: 0
          });
        }
        const balance = memberBalances.get(userId);
        balance.paid += expenseAmount;
        balance.balance += expenseAmount;
      }

      // Process participants (people who owe)
      if (expense.participants && expense.participants.length > 0) {
        expense.participants.forEach(participant => {
          const userId = String(participant.userId);
          const owesAmount = Number(participant.shareAmount || participant.amount) || 0;
          if (!memberBalances.has(userId)) {
            memberBalances.set(userId, {
              userId,
              paid: 0,
              owes: 0,
              balance: 0
            });
          }
          const balance = memberBalances.get(userId);
          balance.owes += owesAmount;
          balance.balance -= owesAmount;
        });
      }
    });

    // Convert map to array and round values
    const balances = Array.from(memberBalances.values()).map(balance => ({
      ...balance,
      paid: Math.round(balance.paid * 100) / 100,
      owes: Math.round(balance.owes * 100) / 100,
      balance: Math.round(balance.balance * 100) / 100
    }));

    return {
      groupId,
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalExpenses: expenses.length,
      balances
    };
  } catch (error) {
    console.error('Error calculating group balance:', error);
    throw new Error('Failed to calculate group balance');
  }
};
