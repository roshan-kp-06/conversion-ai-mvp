/**
 * Email Routes
 *
 * API endpoints for AI-powered email generation and sending.
 * All routes require authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { generateEmail, regenerateEmail, isAIServiceReady } from '../services/ai.service';
import {
  sendSavedEmail,
  sendBatchEmails,
  getEmailStats,
  getEmailServiceStatus,
} from '../services/email.service';
import { prisma } from '../lib/prisma';

const router = Router();

// Apply auth middleware to all routes except /status
router.use((req, res, next) => {
  if (req.path === '/status') {
    return next();
  }
  authMiddleware(req, res, next);
});

/**
 * GET /api/emails/status
 * Check if AI email generation and sending services are ready
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const aiReady = isAIServiceReady();
    const emailServiceStatus = getEmailServiceStatus();

    res.json({
      aiGeneration: {
        ready: aiReady,
        message: aiReady
          ? 'AI email generation service is ready'
          : 'OpenAI API key not configured. AI features are disabled.',
      },
      emailSending: {
        ready: emailServiceStatus.ready,
        fromEmail: emailServiceStatus.fromEmail,
        message: emailServiceStatus.ready
          ? 'Email sending service is ready'
          : 'SendGrid API key not configured. Emails will be sent in mock mode.',
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check service status',
    });
  }
});

/**
 * POST /api/emails/generate
 * Generate a personalized email for a contact
 *
 * Body:
 * - contactId: string (required) - The contact to generate email for
 * - customInstructions: string (optional) - Additional instructions for generation
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { contactId, customInstructions } = req.body;

    // Validate required fields
    if (!contactId) {
      res.status(400).json({ error: 'contactId is required' });
      return;
    }

    // Generate the email
    const result = await generateEmail({
      contactId,
      userId,
      customInstructions,
    });

    if (!result.success) {
      // Determine appropriate status code
      const statusCode = result.error?.includes('not found') || result.error?.includes('access denied')
        ? 404
        : result.error?.includes('not configured') || result.error?.includes('Product context')
        ? 400
        : 500;

      res.status(statusCode).json({ error: result.error });
      return;
    }

    res.json({
      message: 'Email generated successfully',
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/emails/regenerate
 * Regenerate an email with different options
 *
 * Body:
 * - contactId: string (required)
 * - tone: string (optional) - Desired tone (professional, casual, friendly, formal, enthusiastic)
 * - focusOn: string (optional) - What to emphasize in the email
 */
router.post('/regenerate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { contactId, tone, focusOn } = req.body;

    // Validate required fields
    if (!contactId) {
      res.status(400).json({ error: 'contactId is required' });
      return;
    }

    // Validate tone if provided
    const validTones = ['professional', 'casual', 'friendly', 'formal', 'enthusiastic'];
    if (tone && !validTones.includes(tone.toLowerCase())) {
      res.status(400).json({
        error: `Invalid tone. Must be one of: ${validTones.join(', ')}`
      });
      return;
    }

    // Regenerate with options
    const result = await regenerateEmail(contactId, userId, {
      tone: tone?.toLowerCase(),
      focusOn,
    });

    if (!result.success) {
      const statusCode = result.error?.includes('not found') || result.error?.includes('access denied')
        ? 404
        : result.error?.includes('not configured') || result.error?.includes('Product context')
        ? 400
        : 500;

      res.status(statusCode).json({ error: result.error });
      return;
    }

    res.json({
      message: 'Email regenerated successfully',
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/emails/contact/:contactId
 * Get all generated emails for a specific contact
 */
router.get('/contact/:contactId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const contactId = req.params.contactId as string;

    // Verify contact ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: userId,
      },
    });

    if (!contact) {
      res.status(404).json({ error: 'Contact not found or access denied' });
      return;
    }

    // Get emails for this contact
    const emails = await prisma.email.findMany({
      where: {
        contactId: contactId,
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      contactId,
      contactEmail: contact.email,
      contactName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
      emails,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/emails/save
 * Save a generated email to the database
 *
 * Body:
 * - contactId: string (required)
 * - subject: string (required)
 * - bodyText: string (required)
 * - bodyHtml: string (optional)
 */
router.post('/save', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { contactId, subject, bodyText, bodyHtml } = req.body;

    // Validate required fields
    if (!contactId || !subject || !bodyText) {
      res.status(400).json({
        error: 'contactId, subject, and bodyText are required'
      });
      return;
    }

    // Verify contact ownership
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: userId,
      },
    });

    if (!contact) {
      res.status(404).json({ error: 'Contact not found or access denied' });
      return;
    }

    // Save the email
    const email = await prisma.email.create({
      data: {
        userId,
        contactId,
        subject,
        bodyText,
        bodyHtml: bodyHtml || null,
        status: 'draft',
      },
    });

    res.status(201).json({
      message: 'Email saved successfully',
      email,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/emails/:emailId/send
 * Send a saved email to its contact
 */
router.post('/:emailId/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const emailId = req.params.emailId as string;

    const result = await sendSavedEmail({ emailId, userId });

    if (!result.success) {
      const statusCode = result.error?.includes('not found') || result.error?.includes('access denied')
        ? 404
        : result.error?.includes('already been sent')
        ? 409
        : 500;

      res.status(statusCode).json({ error: result.error });
      return;
    }

    res.json({
      message: result.mockMode
        ? 'Email sent successfully (mock mode - SendGrid not configured)'
        : 'Email sent successfully',
      email: result.email,
      mockMode: result.mockMode || false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/emails/send-batch
 * Send multiple emails at once
 *
 * Body:
 * - emailIds: string[] (required) - Array of email IDs to send
 */
router.post('/send-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      res.status(400).json({ error: 'emailIds array is required and must not be empty' });
      return;
    }

    // Limit batch size
    if (emailIds.length > 50) {
      res.status(400).json({ error: 'Maximum 50 emails can be sent in a single batch' });
      return;
    }

    const result = await sendBatchEmails(emailIds, userId);

    res.json({
      message: `Sent ${result.success} emails, ${result.failed} failed`,
      success: result.success,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/emails/stats
 * Get email statistics for the current user
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const stats = await getEmailStats(userId);

    res.json({
      stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/emails/:emailId
 * Get a specific saved email
 */
router.get('/:emailId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const emailId = req.params.emailId as string;

    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId: userId,
      },
      include: {
        contact: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            company: true,
          },
        },
      },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found or access denied' });
      return;
    }

    res.json(email);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/emails/:emailId
 * Update a saved email
 */
router.patch('/:emailId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const emailId = req.params.emailId as string;
    const { subject, bodyText, bodyHtml, status } = req.body;

    // Verify email ownership
    const existingEmail = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId: userId,
      },
    });

    if (!existingEmail) {
      res.status(404).json({ error: 'Email not found or access denied' });
      return;
    }

    // Validate status if provided
    const validStatuses = ['draft', 'sent', 'failed'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    // Update the email
    const email = await prisma.email.update({
      where: { id: emailId },
      data: {
        ...(subject !== undefined && { subject }),
        ...(bodyText !== undefined && { bodyText }),
        ...(bodyHtml !== undefined && { bodyHtml }),
        ...(status !== undefined && { status }),
      },
    });

    res.json({
      message: 'Email updated successfully',
      email,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/emails/:emailId
 * Delete a saved email
 */
router.delete('/:emailId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const emailId = req.params.emailId as string;

    // Verify email ownership
    const existingEmail = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId: userId,
      },
    });

    if (!existingEmail) {
      res.status(404).json({ error: 'Email not found or access denied' });
      return;
    }

    await prisma.email.delete({
      where: { id: emailId },
    });

    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
