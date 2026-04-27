export const createGroup = async ({ name, userId }) => {
  if (!name) {
    const error = new Error("Group name is required");
    error.statusCode = 400;
    throw error;
  }

  const trimmedName = name.trim();

  // 🔥 CHECK FOR DUPLICATE
  const existingGroup = await Group.findOne({
    name: trimmedName,
    createdBy: userId, // IMPORTANT
  });

  if (existingGroup) {
    const error = new Error("Group with this name already exists");
    error.statusCode = 400;
    throw error;
  }

  return await Group.create({
    name: trimmedName,
    members: userId ? [userId] : [],
    createdBy: userId ? userId : null, // ⚠️ FIXED (see below)
  });
};