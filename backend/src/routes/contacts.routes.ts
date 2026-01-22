/**
 * Contacts Routes
 *
 * CRUD routes for contact management.
 * All routes require authentication.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  createContactHandler,
  listContactsHandler,
  getContactHandler,
  updateContactHandler,
  deleteContactHandler,
} from '../controllers/contacts.controller';

const router = Router();

// All contacts routes require authentication
router.use(authMiddleware);

/**
 * POST /contacts
 * Create a new contact
 * Body: { email, firstName?, lastName?, title?, company?, phone?, notes? }
 */
router.post('/', createContactHandler);

/**
 * GET /contacts
 * List all contacts for authenticated user
 */
router.get('/', listContactsHandler);

/**
 * GET /contacts/:id
 * Get a single contact by ID
 */
router.get('/:id', getContactHandler);

/**
 * PUT /contacts/:id
 * Update a contact (email cannot be changed)
 * Body: { firstName?, lastName?, title?, company?, phone?, notes? }
 */
router.put('/:id', updateContactHandler);

/**
 * DELETE /contacts/:id
 * Delete a contact
 */
router.delete('/:id', deleteContactHandler);

export default router;
