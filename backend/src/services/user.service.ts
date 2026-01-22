/**
 * User Service
 *
 * Handles user CRUD operations and business logic.
 * Used by auth controller for registration and login.
 */

import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword, signToken } from '../lib/auth';

// Types
export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export interface UserWithoutPassword {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: UserWithoutPassword;
  token: string;
}

/**
 * Create a new user with hashed password
 * @throws Error if email already exists
 */
export async function createUser(input: CreateUserInput): Promise<AuthResult> {
  const { email, password, name } = input;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error('EMAIL_EXISTS');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Generate JWT token
  const token = signToken({ userId: user.id, email: user.email });

  return { user, token };
}

/**
 * Authenticate user with email and password
 * @throws Error if credentials are invalid
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthResult> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password);

  if (!isValidPassword) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Generate JWT token
  const token = signToken({ userId: user.id, email: user.email });

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    token,
  };
}

/**
 * Get user by ID (without password)
 */
export async function getUserById(
  userId: string
): Promise<UserWithoutPassword | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

/**
 * Get user by email (without password)
 */
export async function getUserByEmail(
  email: string
): Promise<UserWithoutPassword | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  data: { name?: string; email?: string }
): Promise<UserWithoutPassword> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email.toLowerCase() }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}
