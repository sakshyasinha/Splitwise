import Group from "../models/group.model.js";
import User from "../models/user.model.js";
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

export const createGroup = async ({ name, type, userId, members = [] }) => {
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
  const resolvedMembers = await resolveMemberUsers(members);
  const normalizedMembers = [...new Set([String(userId), ...resolvedMembers.map((user) => String(user._id))])];

  const existingGroup = await Group.findOne({
    name: trimmedName,
    type: normalizedType,
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

export const updateGroup = async (groupId, userId, { name, type }) => {
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

  await group.save();
  return group;
};

export const deleteGroup = async (groupId, userId) => {
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
    const error = new Error("Only group creator can delete");
    error.statusCode = 403;
    throw error;
  }

  group.archived = true;
  await group.save();
};

export const addMember = async (groupId, userId, memberId) => {
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

  const memberIdStr = String(memberId);
  if (!group.members.some(id => String(id) === memberIdStr)) {
    group.members.push(memberId);
    await group.save();
  }

  return group;
};

export const removeMember = async (groupId, userId, memberId) => {
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

  const memberIdStr = String(memberId);
  group.members = group.members.filter(id => String(id) !== memberIdStr);
  await group.save();

  return group;
};
