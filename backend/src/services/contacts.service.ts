/**
 * Contacts Service
 *
 * CRUD operations for contacts with business email detection integration.
 * Business contacts get company domain extracted and research status set to 'pending'.
 * Personal contacts get research status set to 'na' (not applicable).
 */

import { prisma } from '../lib/prisma';
import { Contact, ResearchStatus } from '@prisma/client';
import { isBusinessEmail, extractDomain, normalizeEmail } from '../lib/emailUtils';
import { researchContactCompany } from './research.service';

// Types for contact operations
export interface CreateContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateContactInput {
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  phone?: string;
  notes?: string;
}

export interface ContactWithResearchInfo extends Contact {
  isBusinessContact: boolean;
}

/**
 * Create a new contact for a user
 * Automatically detects business vs personal email and sets appropriate status
 */
export async function createContact(
  userId: string,
  input: CreateContactInput
): Promise<ContactWithResearchInfo> {
  // Normalize and validate email
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new Error('Invalid email address');
  }

  // Check for duplicate email for this user
  const existingContact = await prisma.contact.findUnique({
    where: {
      userId_email: {
        userId,
        email: normalizedEmail,
      },
    },
  });

  if (existingContact) {
    throw new Error('Contact with this email already exists');
  }

  // Determine if business email
  const isBusiness = isBusinessEmail(normalizedEmail);
  const domain = extractDomain(normalizedEmail);

  // Create the contact with appropriate status
  const contact = await prisma.contact.create({
    data: {
      userId,
      email: normalizedEmail,
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      title: input.title?.trim() || null,
      company: input.company?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      companyDomain: isBusiness ? domain : null,
      researchStatus: isBusiness ? ResearchStatus.pending : ResearchStatus.na,
    },
  });

  // Trigger research automatically for business contacts (async, non-blocking)
  if (isBusiness && domain) {
    // Fire and forget - don't await, let it run in background
    researchContactCompany(contact.id, domain)
      .then(result => {
        console.log(`[Contact] Auto-research completed for ${normalizedEmail}: ${result.success ? 'success' : 'failed'}`);
      })
      .catch(err => {
        console.error(`[Contact] Auto-research error for ${normalizedEmail}:`, err.message);
      });
  }

  return {
    ...contact,
    isBusinessContact: isBusiness,
  };
}

/**
 * Get all contacts for a user
 */
export async function getContactsByUserId(userId: string): Promise<Contact[]> {
  return prisma.contact.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single contact by ID (must belong to user)
 */
export async function getContactById(
  userId: string,
  contactId: string
): Promise<Contact | null> {
  return prisma.contact.findFirst({
    where: {
      id: contactId,
      userId,
    },
  });
}

/**
 * Update a contact (only non-email fields - email is immutable)
 */
export async function updateContact(
  userId: string,
  contactId: string,
  input: UpdateContactInput
): Promise<Contact | null> {
  // First verify contact belongs to user
  const existing = await getContactById(userId, contactId);
  if (!existing) {
    return null;
  }

  return prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName: input.firstName !== undefined ? input.firstName?.trim() || null : existing.firstName,
      lastName: input.lastName !== undefined ? input.lastName?.trim() || null : existing.lastName,
      title: input.title !== undefined ? input.title?.trim() || null : existing.title,
      company: input.company !== undefined ? input.company?.trim() || null : existing.company,
      phone: input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
      notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
    },
  });
}

/**
 * Delete a contact (must belong to user)
 */
export async function deleteContact(
  userId: string,
  contactId: string
): Promise<boolean> {
  // First verify contact belongs to user
  const existing = await getContactById(userId, contactId);
  if (!existing) {
    return false;
  }

  await prisma.contact.delete({
    where: { id: contactId },
  });

  return true;
}

/**
 * Get contacts count for a user
 */
export async function getContactsCount(userId: string): Promise<number> {
  return prisma.contact.count({
    where: { userId },
  });
}

/**
 * Get contacts by research status
 */
export async function getContactsByResearchStatus(
  userId: string,
  status: ResearchStatus
): Promise<Contact[]> {
  return prisma.contact.findMany({
    where: {
      userId,
      researchStatus: status,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get pending research contacts (business emails awaiting research)
 */
export async function getPendingResearchContacts(userId: string): Promise<Contact[]> {
  return getContactsByResearchStatus(userId, ResearchStatus.pending);
}
