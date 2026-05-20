import * as authService from '../services/auth.service.js';
import * as tokenService from '../services/token.service.js';

export const registerUser=async(req,res)=>{
    try {
        const user = await authService.registerUser(req.body);
        res.status(201).json(user);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const loginUser=async(req,res)=>{
    try {
        const data = await authService.loginUser(req.body);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const refreshToken=async(req,res)=>{
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: 'refreshToken is required' });
        }
        const tokens = await tokenService.refreshAccessToken(refreshToken);
        res.json(tokens);
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
};

export const logout=async(req,res)=>{
    try {
        await tokenService.revokeRefreshToken(req.user.id);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};