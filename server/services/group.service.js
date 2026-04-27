import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

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

export const createGroup = async ({ name, userId, members = [] }) => {
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
  const resolvedMembers = await resolveMemberUsers(members);
  const normalizedMembers = [...new Set([String(userId), ...resolvedMembers.map((user) => String(user._id))])];

  const existingGroup = await Group.findOne({
    name: trimmedName,
    createdBy: userId,
  });

  if (existingGroup) {
    existingGroup.members = Array.from(
      new Set([
        ...(existingGroup.members || []).map(String),
        ...normalizedMembers.map(String),
      ])
    );

    await existingGroup.save();
    return existingGroup;
  }

  return await Group.create({
    name: trimmedName,
    members: normalizedMembers,
    createdBy: [userId],
  });
};