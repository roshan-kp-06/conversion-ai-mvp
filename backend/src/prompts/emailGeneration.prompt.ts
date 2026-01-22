/**
 * Email Generation Prompts
 *
 * System and user prompts for AI-powered cold email generation.
 * Designed to create personalized, conversion-focused emails that
 * leverage company research and product context.
 */

import { CompanyResearch } from '@prisma/client';

// Types for prompt generation
export interface ProductContext {
  productName: string;
  productDescription: string;
  targetAudience: string;
  painPoints: string;
  valueProposition: string;
  tone?: string;
}

export interface ContactInfo {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  title?: string | null;
  company?: string | null;
}

/**
 * System prompt that defines the AI's role and guidelines
 */
export const EMAIL_SYSTEM_PROMPT = `You are an expert B2B cold email copywriter. Your job is to write highly personalized, conversion-focused cold emails.

CORE PRINCIPLES:
1. Personalization is key - reference specific details about the recipient's company
2. Lead with value, not features - focus on outcomes and benefits
3. Keep it concise - busy executives skim, so every word must earn its place
4. Sound human, not salesy - avoid marketing jargon and buzzwords
5. One clear call-to-action - make the next step obvious and easy

EMAIL STRUCTURE:
- Subject: 5-8 words, creates curiosity, personalized when possible
- Opening: 1-2 sentences that show you've done your research
- Value Bridge: Connect their situation to your solution (2-3 sentences)
- Proof/Credibility: Brief mention of results or relevance
- CTA: Simple, low-commitment ask (reply, quick call, etc.)

TONE GUIDELINES:
- Professional but conversational
- Confident but not arrogant
- Helpful, not pushy
- Specific, not generic

OUTPUT FORMAT:
Return your response as valid JSON with exactly this structure:
{
  "subject": "Email subject line here",
  "body": "Full email body here with proper line breaks using \\n"
}

Do NOT include any text outside the JSON object.`;

/**
 * Build the user prompt with all context for email generation
 */
export function buildEmailGenerationPrompt(
  contact: ContactInfo,
  productContext: ProductContext,
  companyResearch: CompanyResearch | null
): string {
  const contactName = contact.firstName || 'there';
  const contactFullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'the recipient';
  const contactTitle = contact.title || 'professional';
  const contactCompany = contact.company || companyResearch?.companyName || 'their company';

  // Build company research section
  let companyInfo = 'No specific company research available.';
  if (companyResearch) {
    const details: string[] = [];

    if (companyResearch.companyName) {
      details.push(`Company: ${companyResearch.companyName}`);
    }
    if (companyResearch.industry) {
      details.push(`Industry: ${companyResearch.industry}`);
    }
    if (companyResearch.description) {
      details.push(`About: ${companyResearch.description}`);
    }
    if (companyResearch.employeeCount) {
      details.push(`Size: ${companyResearch.employeeCount} employees`);
    }
    if (companyResearch.location) {
      details.push(`Location: ${companyResearch.location}`);
    }
    if (companyResearch.technologies && companyResearch.technologies.length > 0) {
      details.push(`Tech Stack: ${companyResearch.technologies.join(', ')}`);
    }

    if (details.length > 0) {
      companyInfo = details.join('\n');
    }
  }

  // Determine tone
  const tone = productContext.tone || 'professional';
  const toneGuidance = getToneGuidance(tone);

  return `
TASK: Write a personalized cold email to ${contactFullName}.

---
RECIPIENT INFORMATION:
Name: ${contactFullName}
Email: ${contact.email}
Title: ${contactTitle}
Company: ${contactCompany}

---
COMPANY RESEARCH:
${companyInfo}

---
YOUR PRODUCT/SERVICE:
Product Name: ${productContext.productName}
Description: ${productContext.productDescription}
Target Audience: ${productContext.targetAudience}
Pain Points We Solve: ${productContext.painPoints}
Value Proposition: ${productContext.valueProposition}

---
TONE: ${tone}
${toneGuidance}

---
INSTRUCTIONS:
1. Write a subject line that would make ${contactName} want to open the email
2. Open with something specific about ${contactCompany} or their industry
3. Bridge to how ${productContext.productName} can help them specifically
4. End with a simple, low-pressure call-to-action
5. Keep the total email under 150 words

Remember: Return ONLY valid JSON with "subject" and "body" keys.`;
}

/**
 * Get tone-specific guidance
 */
function getToneGuidance(tone: string): string {
  const toneMap: Record<string, string> = {
    professional: 'Use formal but friendly language. Be direct and respectful.',
    casual: 'Use a relaxed, conversational tone. Feel free to use contractions and be more informal.',
    friendly: 'Be warm and approachable. Use a personable tone that builds rapport.',
    formal: 'Use highly professional language. Maintain business formality throughout.',
    enthusiastic: 'Show genuine excitement about helping them. Be energetic but not over-the-top.',
  };

  return toneMap[tone.toLowerCase()] || toneMap.professional;
}

/**
 * Parse the AI response to extract subject and body
 */
export function parseEmailResponse(response: string): { subject: string; body: string } {
  try {
    // Try to parse as JSON directly
    const parsed = JSON.parse(response);

    if (!parsed.subject || !parsed.body) {
      throw new Error('Response missing subject or body');
    }

    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
    };
  } catch (error) {
    // If JSON parsing fails, try to extract from text
    console.warn('[EmailPrompt] JSON parsing failed, attempting text extraction');

    // Try to find JSON object in the response
    const jsonMatch = response.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]);
        return {
          subject: extracted.subject.trim(),
          body: extracted.body.trim(),
        };
      } catch {
        // Continue to fallback
      }
    }

    // Last resort: try to parse subject and body manually
    const subjectMatch = response.match(/subject["\s:]+([^\n"]+)/i);
    const bodyMatch = response.match(/body["\s:]+(.+)/is);

    if (subjectMatch && bodyMatch) {
      return {
        subject: subjectMatch[1].trim().replace(/^["']|["']$/g, ''),
        body: bodyMatch[1].trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n'),
      };
    }

    throw new Error('Could not parse email from AI response');
  }
}
