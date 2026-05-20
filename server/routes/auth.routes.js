import express from 'express';
import {registerUser,loginUser} from '../controllers/auth.controller.js'
import validate from '../middleware/validation.middleware.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';

const router=express.Router();

router.post('/login', validate(loginSchema), loginUser);
router.post('/register', validate(registerSchema), registerUser);

export default router;

