/**
 * Auth Routes
 *
 * Authentication endpoints for user registration and login.
 * POST /auth/register - Create new account
 * POST /auth/login - Authenticate user
 * POST /auth/logout - Log out user
 * GET /auth/me - Get current user (protected)
 */

import { Router } from 'express';
import {
  register,
  login,
  logout,
  getCurrentUser,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected routes
router.get('/me', authMiddleware, getCurrentUser);

export default router;
