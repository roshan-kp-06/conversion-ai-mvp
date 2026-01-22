/**
 * Onboarding Routes
 *
 * Routes for user onboarding including product context management.
 * All routes are protected and require authentication.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getProductContextHandler,
  updateProductContextHandler,
  getOnboardingStatusHandler,
} from '../controllers/onboarding.controller';

const router = Router();

// All onboarding routes require authentication
router.use(authMiddleware);

/**
 * GET /onboarding/status
 * Check if user has completed onboarding
 */
router.get('/status', getOnboardingStatusHandler);

/**
 * GET /onboarding/product-context
 * Get the current user's product context
 */
router.get('/product-context', getProductContextHandler);

/**
 * PUT /onboarding/product-context
 * Create or update the current user's product context
 */
router.put('/product-context', updateProductContextHandler);

export default router;
