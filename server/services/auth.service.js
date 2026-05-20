import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as tokenService from './token.service.js';

function toPublicUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email
    };
}

export const registerUser=async({name,email,password})=>{
    if (!name || !email || !password) {
        const error = new Error('name, email and password are required');
        error.statusCode = 400;
        throw error;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
        const error = new Error('Email already registered');
        error.statusCode = 409;
        throw error;
    }

    const hashed=await bcrypt.hash(password,10);

    const user=await User.create({
        name: String(name).trim(),
        email: normalizedEmail,
        password:hashed,
    });
    return toPublicUser(user);
};

export const loginUser=async({email,password})=>{
        if (!email || !password) {
            const error = new Error('email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user=await User.findOne({email: normalizedEmail});

        if(!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }


        const isMatch=await bcrypt.compare(password,user.password);

        if(!isMatch) {
            const error = new Error('invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        const { accessToken, refreshToken } = tokenService.generateTokens(user._id.toString());
        await tokenService.storeRefreshToken(user._id.toString(), refreshToken);

        return {
            accessToken,
            refreshToken,
            user: toPublicUser(user)
        };
};