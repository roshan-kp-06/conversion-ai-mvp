/**
 * Auth Controller
 *
 * Handles authentication endpoints: register, login, logout.
 * Manages user sessions via JWT tokens.
 */

import { Request, Response } from 'express';
import { createUser, authenticateUser, getUserById } from '../services/user.service';
import {
  validateRegisterInput,
  validateLoginInput,
  formatValidationErrors,
} from '../validators/auth.validator';

/**
 * POST /auth/register
 * Creates a new user account and returns JWT token
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    // Validate input
    const validation = validateRegisterInput({ email, password, name });
    if (!validation.valid) {
      res.status(400).json({
        error: formatValidationErrors(validation.errors),
      });
      return;
    }

    // Create user
    const result = await createUser({ email, password, name });

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'EMAIL_EXISTS') {
        res.status(400).json({
          error: {
            message: 'An account with this email already exists',
            code: 'EMAIL_EXISTS',
          },
        });
        return;
      }
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * POST /auth/login
 * Authenticates user and returns JWT token
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    // Validate input
    const validation = validateLoginInput({ email, password });
    if (!validation.valid) {
      res.status(400).json({
        error: formatValidationErrors(validation.errors),
      });
      return;
    }

    // Authenticate user
    const result = await authenticateUser(email, password);

    res.status(200).json({
      message: 'Login successful',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVALID_CREDENTIALS') {
        res.status(401).json({
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS',
          },
        });
        return;
      }
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * POST /auth/logout
 * Logs out the current user (client-side token removal)
 * For stateless JWT, this is mainly a client-side action
 * Server can acknowledge the logout request
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  // With stateless JWT, logout is handled client-side by removing the token
  // This endpoint exists for API consistency and future token blacklisting
  res.status(200).json({
    message: 'Logged out successfully',
  });
}

/**
 * GET /auth/me
 * Returns the current authenticated user
 * Requires authMiddleware
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
      return;
    }

    const user = await getUserById(userId);

    if (!user) {
      res.status(404).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({
      user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}
