import * as groupService from '../services/group.service.js';

export const createGroup=async(req,res)=>{
    try {
        const group = await groupService.createGroup({
            name: req.body.name,
            userId: req.user?.id || req.body.userId
        });
        res.status(201).json(group);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};