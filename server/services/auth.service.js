import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import * as tokenService from './token.service.js';

function toPublicUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        authProvider: user.authProvider || 'local'
    };
}

function getGoogleClientId() {
    return process.env.GOOGLE_CLIENT_ID
        || process.env.GOOGLE_AUTH_CLIENT_ID
        || process.env.GOOGLE_OAUTH_CLIENT_ID
        || process.env.GOOGLE_CLIENT
        || process.env.google_client_id;
}

function issueSessionForUser(user) {
    const { accessToken, refreshToken } = tokenService.generateTokens(user._id.toString());
    return tokenService.storeRefreshToken(user._id.toString(), refreshToken).then(() => ({
        token: accessToken,
        accessToken,
        refreshToken,
        user: toPublicUser(user)
    }));
}

async function verifyGoogleCredential(credential) {
    const clientId = getGoogleClientId();
    if (!clientId) {
        const error = new Error('Google auth is not configured');
        error.statusCode = 500;
        throw error;
    }

    if (!credential) {
        const error = new Error('Google credential is required');
        error.statusCode = 400;
        throw error;
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
        const error = new Error(payload?.error_description || 'Invalid Google credential');
        error.statusCode = 401;
        throw error;
    }

    if (payload.aud !== clientId) {
        const error = new Error('Google credential was issued for a different client');
        error.statusCode = 401;
        throw error;
    }

    if (payload.email_verified !== 'true' && payload.email_verified !== true) {
        const error = new Error('Google email is not verified');
        error.statusCode = 401;
        throw error;
    }

    return payload;
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

        if (!user.password) {
            const error = new Error('This account uses Google sign-in');
            error.statusCode = 401;
            throw error;
        }

        const isMatch=await bcrypt.compare(password,user.password);

        if(!isMatch) {
            const error = new Error('invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        return issueSessionForUser(user);
};

export const getGoogleAuthConfig = () => {
    const clientId = getGoogleClientId();
    return {
        enabled: Boolean(clientId),
        clientId: clientId || null
    };
};

export const loginWithGoogle = async ({ credential }) => {
    const googleUser = await verifyGoogleCredential(credential);
    const normalizedEmail = String(googleUser.email || '').trim().toLowerCase();

    if (!normalizedEmail) {
        const error = new Error('Google account did not provide an email');
        error.statusCode = 401;
        throw error;
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        user = await User.create({
            name: String(googleUser.name || normalizedEmail.split('@')[0]).trim(),
            email: normalizedEmail,
            authProvider: 'google',
            googleId: googleUser.sub,
            avatarUrl: googleUser.picture || undefined,
            isTemporary: false
        });
    } else {
        user.name = user.name || String(googleUser.name || normalizedEmail.split('@')[0]).trim();
        user.authProvider = user.authProvider === 'local' && user.password ? 'local' : 'google';
        user.googleId = user.googleId || googleUser.sub;
        user.avatarUrl = googleUser.picture || user.avatarUrl;
        user.isTemporary = false;
        await user.save();
    }

    return issueSessionForUser(user);
};
