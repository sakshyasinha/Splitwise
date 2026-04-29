import * as groupService from '../services/group.service.js';

export const createGroup=async(req,res)=>{
    try {
        const group = await groupService.createGroup({
            name: req.body.name,
            type: req.body.type,
            description: req.body.description || "",
            userId: req.user?.id || req.body.userId,
            members: req.body.members || []
        });
        await group.populate("members", "name email");
        await group.populate("createdBy", "name email");

        const response = group.toObject();
        const warning = group.warning;
        const isExisting = group.isExisting;

        if (warning) {
            res.status(200).json({ ...response, warning, isExisting });
        } else {
            res.status(201).json(response);
        }
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
                type: req.body.type,
                description: req.body.description
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
        const result = await groupService.deleteGroup(
            req.params.id,
            req.user?.id || req.body.userId
        );
        res.status(200).json(result || { message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error in deleteGroup controller:', error);
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
        console.error('Error in addMember controller:', error);
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
        console.error('Error in removeMember controller:', error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getGroupBalance = async (req, res) => {
    try {
        const balance = await groupService.getGroupBalance(req.params.id);
        res.status(200).json(balance);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};