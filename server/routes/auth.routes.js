import express from 'express';
import {registerUser, loginUser, refreshToken, logout, googleLogin, getGoogleAuthConfig, getCurrentUser} from '../controllers/auth.controller.js'
import validate from '../middleware/validation.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema, googleLoginSchema } from '../schemas/auth.schema.js';
import { protect } from '../middleware/auth.middleware.js';
// import { authEndpointsLimiter } from '../middleware/rate-limit.middleware.js';

const router=express.Router();

router.post('/login',  validate(loginSchema), loginUser);
router.post('/register', validate(registerSchema), registerUser);
router.get('/google/config', getGoogleAuthConfig);
router.post('/google',  validate(googleLoginSchema), googleLogin);
router.get('/me', protect, getCurrentUser);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);
router.post('/logout', protect, logout);

export default router;

