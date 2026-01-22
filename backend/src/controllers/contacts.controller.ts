/**
 * Contacts Controller
 *
 * Route handlers for contact CRUD operations.
 * All routes require authentication.
 */

import { Request, Response } from 'express';
import {
  createContact,
  getContactsByUserId,
  getContactById,
  updateContact,
  deleteContact,
  CreateContactInput,
  UpdateContactInput,
} from '../services/contacts.service';

/**
 * POST /contacts
 * Create a new contact
 */
export async function createContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const input: CreateContactInput = req.body;

    // Validate required field
    if (!input.email) {
      res.status(400).json({
        error: {
          message: 'Email is required',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    const contact = await createContact(userId, input);

    res.status(201).json({
      message: 'Contact created successfully',
      contact,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create contact';

    // Handle specific errors
    if (message === 'Invalid email address') {
      res.status(400).json({
        error: {
          message,
          code: 'INVALID_EMAIL',
        },
      });
      return;
    }

    if (message === 'Contact with this email already exists') {
      res.status(400).json({
        error: {
          message,
          code: 'DUPLICATE_EMAIL',
        },
      });
      return;
    }

    console.error('Create contact error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create contact',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * GET /contacts
 * List all contacts for the authenticated user
 */
export async function listContactsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const contacts = await getContactsByUserId(userId);

    res.json({
      contacts,
      count: contacts.length,
    });
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to list contacts',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * GET /contacts/:id
 * Get a single contact by ID
 */
export async function getContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const contact = await getContactById(userId, id);

    if (!contact) {
      res.status(404).json({
        error: {
          message: 'Contact not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    res.json({ contact });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get contact',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * PUT /contacts/:id
 * Update a contact (email cannot be changed)
 */
export async function updateContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const input: UpdateContactInput = req.body;

    // Check if trying to update email (not allowed)
    if ('email' in req.body) {
      res.status(400).json({
        error: {
          message: 'Email cannot be changed. Delete and create a new contact instead.',
          code: 'EMAIL_IMMUTABLE',
        },
      });
      return;
    }

    const contact = await updateContact(userId, id, input);

    if (!contact) {
      res.status(404).json({
        error: {
          message: 'Contact not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    res.json({
      message: 'Contact updated successfully',
      contact,
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update contact',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

/**
 * DELETE /contacts/:id
 * Delete a contact
 */
export async function deleteContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const deleted = await deleteContact(userId, id);

    if (!deleted) {
      res.status(404).json({
        error: {
          message: 'Contact not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    res.json({
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete contact',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}
