import Group from "../models/group.model.js";

export const createGroup = async ({ name, userId }) => {
  if (!name) {
    const error = new Error("Group name is required");
    error.statusCode = 400;
    throw error;
  }

  const trimmedName = name.trim();
  const normalizedMembers = userId ? [userId] : [];

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
    createdBy: userId,
  });
};