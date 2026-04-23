import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const registerUser=async({name,email,password})=>{
    if (!name || !email || !password) {
        const error = new Error('name, email and password are required');
        error.statusCode = 400;
        throw error;
    }

    const hashed=await bcrypt.hash(password,10);

    const user=await User.create({
        name,
        email,
        password:hashed,
    });
    return user;
};

export const loginUser=async({email,password})=>{
        if (!email || !password) {
            const error = new Error('email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const user=await User.findOne({email});

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

        return jwt.sign({id:user._id},process.env.JWT_SECRET, { expiresIn: '7d' });
};