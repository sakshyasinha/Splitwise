import * as groupService from '../services/group.service.js';

export const createGroup=async(req,res)=>{
    try {
        const group = await groupService.createGroup({
            name: req.body.name,
            type: req.body.type,
            userId: req.user?.id || req.body.userId,
            members: req.body.members || []
        });
        await group.populate("members", "name email");
        await group.populate("createdBy", "name email");
        res.status(201).json(group);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getGroups = async (req, res) => {
    try {
        const groups = await groupService.getGroups(req.user?.id || req.body.userId);
        res.status(200).json(groups);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateGroup = async (req, res) => {
    try {
        const group = await groupService.updateGroup(
            req.params.id,
            req.user?.id || req.body.userId,
            {
                name: req.body.name,
                type: req.body.type
            }
        );
        await group.populate("members", "name email");
        await group.populate("createdBy", "name email");
        res.status(200).json(group);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteGroup = async (req, res) => {
    try {
        await groupService.deleteGroup(
            req.params.id,
            req.user?.id || req.body.userId
        );
        res.status(200).json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const addMember = async (req, res) => {
    try {
        const group = await groupService.addMember(
            req.params.id,
            req.user?.id || req.body.userId,
            req.body.memberId
        );
        await group.populate("members", "name email");
        await group.populate("createdBy", "name email");
        res.status(200).json(group);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const removeMember = async (req, res) => {
    try {
        const group = await groupService.removeMember(
            req.params.id,
            req.user?.id || req.body.userId,
            req.body.memberId
        );
        await group.populate("members", "name email");
        await group.populate("createdBy", "name email");
        res.status(200).json(group);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};