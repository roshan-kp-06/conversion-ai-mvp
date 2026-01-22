/**
 * Product Context Service
 *
 * Handles CRUD operations for user's product/business context.
 * This context is used to personalize AI-generated emails.
 */

import { prisma } from '../lib/prisma';

// Types
export interface ProductContextInput {
  productName: string;
  productDescription: string;
  targetAudience: string;
  painPoints: string;
  valueProposition: string;
  tone?: string;
}

export interface ProductContextResponse {
  id: string;
  userId: string;
  productName: string;
  productDescription: string;
  targetAudience: string;
  painPoints: string;
  valueProposition: string;
  tone: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get product context for a user
 * Returns null if user hasn't set up their context yet
 */
export async function getProductContext(
  userId: string
): Promise<ProductContextResponse | null> {
  const context = await prisma.productContext.findUnique({
    where: { userId },
  });

  return context;
}

/**
 * Create or update product context for a user
 * Uses upsert to handle both new and existing contexts
 */
export async function upsertProductContext(
  userId: string,
  input: ProductContextInput
): Promise<ProductContextResponse> {
  const { productName, productDescription, targetAudience, painPoints, valueProposition, tone } = input;

  const context = await prisma.productContext.upsert({
    where: { userId },
    update: {
      productName,
      productDescription,
      targetAudience,
      painPoints,
      valueProposition,
      tone: tone || 'professional',
    },
    create: {
      userId,
      productName,
      productDescription,
      targetAudience,
      painPoints,
      valueProposition,
      tone: tone || 'professional',
    },
  });

  return context;
}

/**
 * Delete product context for a user
 * Returns true if deleted, false if not found
 */
export async function deleteProductContext(userId: string): Promise<boolean> {
  try {
    await prisma.productContext.delete({
      where: { userId },
    });
    return true;
  } catch (error) {
    // Record not found
    return false;
  }
}

/**
 * Check if user has completed onboarding (has product context)
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const context = await prisma.productContext.findUnique({
    where: { userId },
    select: { id: true },
  });

  return context !== null;
}
