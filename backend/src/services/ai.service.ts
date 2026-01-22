/**
 * AI Service
 *
 * Provides AI-powered functionality for the Conversion.ai platform.
 * Primary function: Generate personalized cold emails using OpenAI GPT-4.
 */

import { CompanyResearch } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { chatCompletion, isOpenAIConfigured, TEMPERATURE, MAX_TOKENS } from '../lib/openai';
import {
  EMAIL_SYSTEM_PROMPT,
  buildEmailGenerationPrompt,
  parseEmailResponse,
  ProductContext,
  ContactInfo,
} from '../prompts/emailGeneration.prompt';

// Types
export interface GeneratedEmail {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export interface EmailGenerationResult {
  success: boolean;
  email: GeneratedEmail | null;
  error?: string;
}

export interface EmailGenerationInput {
  contactId: string;
  userId: string;
  customInstructions?: string;
}

/**
 * Generate a personalized email for a contact
 *
 * This function:
 * 1. Fetches the contact and validates ownership
 * 2. Retrieves company research for the contact's domain
 * 3. Retrieves the user's product context
 * 4. Generates a personalized email using GPT-4
 * 5. Returns the subject and body
 */
export async function generateEmail(input: EmailGenerationInput): Promise<EmailGenerationResult> {
  const { contactId, userId, customInstructions } = input;

  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    return {
      success: false,
      email: null,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    // 1. Fetch the contact with ownership check
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: userId,
      },
    });

    if (!contact) {
      return {
        success: false,
        email: null,
        error: 'Contact not found or access denied',
      };
    }

    // 2. Fetch company research if available
    let companyResearch: CompanyResearch | null = null;
    if (contact.companyDomain) {
      companyResearch = await prisma.companyResearch.findUnique({
        where: { domain: contact.companyDomain },
      });
    }

    // 3. Fetch user's product context
    const productContextRecord = await prisma.productContext.findUnique({
      where: { userId: userId },
    });

    if (!productContextRecord) {
      return {
        success: false,
        email: null,
        error: 'Product context not set. Please configure your product information first.',
      };
    }

    // Build product context object
    const productContext: ProductContext = {
      productName: productContextRecord.productName,
      productDescription: productContextRecord.productDescription,
      targetAudience: productContextRecord.targetAudience,
      painPoints: productContextRecord.painPoints,
      valueProposition: productContextRecord.valueProposition,
      tone: productContextRecord.tone || 'professional',
    };

    // Build contact info object
    const contactInfo: ContactInfo = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      title: contact.title,
      company: contact.company,
    };

    // 4. Build the prompt
    let userPrompt = buildEmailGenerationPrompt(contactInfo, productContext, companyResearch);

    // Add custom instructions if provided
    if (customInstructions) {
      userPrompt += `\n\n---\nADDITIONAL INSTRUCTIONS:\n${customInstructions}`;
    }

    // 5. Generate email using OpenAI
    console.log(`[AI] Generating email for contact ${contactId} (${contact.email})`);

    const response = await chatCompletion(
      EMAIL_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: TEMPERATURE.BALANCED,
        maxTokens: MAX_TOKENS.FULL_EMAIL,
      }
    );

    // 6. Parse the response
    const { subject, body } = parseEmailResponse(response);

    // 7. Convert plain text body to simple HTML
    const bodyHtml = convertToHtml(body);

    console.log(`[AI] Successfully generated email for ${contact.email}`);
    console.log(`[AI] Subject: ${subject}`);

    return {
      success: true,
      email: {
        subject,
        bodyText: body,
        bodyHtml,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AI] Email generation failed:`, errorMessage);

    return {
      success: false,
      email: null,
      error: `Email generation failed: ${errorMessage}`,
    };
  }
}

/**
 * Convert plain text email body to simple HTML
 */
function convertToHtml(text: string): string {
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert line breaks to <br> tags
  const withBreaks = escaped.replace(/\n/g, '<br>\n');

  // Wrap in basic HTML structure
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">\n${withBreaks}\n</div>`;
}

/**
 * Regenerate an email with different parameters
 */
export async function regenerateEmail(
  contactId: string,
  userId: string,
  options?: {
    tone?: string;
    focusOn?: string;
  }
): Promise<EmailGenerationResult> {
  let customInstructions = '';

  if (options?.tone) {
    customInstructions += `Use a ${options.tone} tone.\n`;
  }

  if (options?.focusOn) {
    customInstructions += `Focus especially on: ${options.focusOn}\n`;
  }

  return generateEmail({
    contactId,
    userId,
    customInstructions: customInstructions || undefined,
  });
}

/**
 * Check if AI service is ready to use
 */
export function isAIServiceReady(): boolean {
  return isOpenAIConfigured();
}
