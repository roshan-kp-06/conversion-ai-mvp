/**
 * Onboarding Controller
 *
 * Handles onboarding-related endpoints including product context management.
 */

import { Request, Response } from 'express';
import {
  getProductContext,
  upsertProductContext,
  hasCompletedOnboarding,
  ProductContextInput,
} from '../services/productContext.service';

// Validation helper
interface ValidationError {
  field: string;
  message: string;
}

function validateProductContextInput(data: Partial<ProductContextInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.productName || data.productName.trim().length === 0) {
    errors.push({ field: 'productName', message: 'Product name is required' });
  }

  if (!data.productDescription || data.productDescription.trim().length === 0) {
    errors.push({ field: 'productDescription', message: 'Product description is required' });
  }

  if (!data.targetAudience || data.targetAudience.trim().length === 0) {
    errors.push({ field: 'targetAudience', message: 'Target audience is required' });
  }

  if (!data.painPoints || data.painPoints.trim().length === 0) {
    errors.push({ field: 'painPoints', message: 'Pain points are required' });
  }

  if (!data.valueProposition || data.valueProposition.trim().length === 0) {
    errors.push({ field: 'valueProposition', message: 'Value proposition is required' });
  }

  // Validate tone if provided
  if (data.tone) {
    const validTones = ['professional', 'friendly', 'casual'];
    if (!validTones.includes(data.tone)) {
      errors.push({
        field: 'tone',
        message: `Tone must be one of: ${validTones.join(', ')}`,
      });
    }
  }

  return errors;
}

/**
 * GET /onboarding/product-context
 * Get the current user's product context
 */
export async function getProductContextHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const context = await getProductContext(userId);

    if (!context) {
      res.status(404).json({
        error: {
          message: 'Product context not found. Please complete onboarding.',
          code: 'CONTEXT_NOT_FOUND',
        },
      });
      return;
    }

    res.json({
      productContext: context,
    });
  } catch (error) {
    console.error('Error getting product context:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * PUT /onboarding/product-context
 * Create or update the current user's product context
 */
export async function updateProductContextHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const input = req.body as Partial<ProductContextInput>;

    // Validate input
    const errors = validateProductContextInput(input);
    if (errors.length > 0) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        },
      });
      return;
    }

    // Upsert the context
    const context = await upsertProductContext(userId, input as ProductContextInput);

    res.json({
      message: 'Product context saved successfully',
      productContext: context,
    });
  } catch (error) {
    console.error('Error updating product context:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * GET /onboarding/status
 * Check if user has completed onboarding
 */
export async function getOnboardingStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const completed = await hasCompletedOnboarding(userId);

    res.json({
      completed,
      nextStep: completed ? null : '/onboarding/product-context',
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}
