import Group from '../models/group.model.js';

export const createGroup=async({ name, userId })=>{
    if (!name) {
        const error = new Error('Group name is required');
        error.statusCode = 400;
        throw error;
    }

    return await Group.create({
        name,
        members: userId ? [userId] : [],
        createdBy: userId ? [userId] : [],
    });
};