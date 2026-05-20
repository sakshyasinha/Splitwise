import express from 'express';
import {registerUser, loginUser, refreshToken, logout} from '../controllers/auth.controller.js'
import validate from '../middleware/validation.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../schemas/auth.schema.js';
import { protect } from '../middleware/auth.middleware.js';

const router=express.Router();

router.post('/login', validate(loginSchema), loginUser);
router.post('/register', validate(registerSchema), registerUser);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);
router.post('/logout', protect, logout);

export default router;

