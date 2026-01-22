/**
 * Research Service
 *
 * Handles company research/enrichment for contacts.
 * Uses Clearbit API (or mock data) to enrich company information.
 */

import { prisma } from '../lib/prisma';
import { clearbitClient, CompanyData, EnrichmentResult } from '../lib/clearbit';
import { ResearchStatus, CompanyResearch, Prisma } from '@prisma/client';

export interface ResearchResult {
  success: boolean;
  domain: string;
  status: ResearchStatus;
  companyResearch: CompanyResearch | null;
  error?: string;
}

/**
 * Research a company by domain
 *
 * @param domain - The company domain to research (e.g., "acme.com")
 * @returns ResearchResult with company data or error
 */
export async function researchCompany(domain: string): Promise<ResearchResult> {
  const normalizedDomain = domain.toLowerCase().trim();

  // Check if we already have research for this domain
  const existingResearch = await prisma.companyResearch.findUnique({
    where: { domain: normalizedDomain }
  });

  if (existingResearch) {
    console.log(`[Research] Cache hit for domain: ${normalizedDomain}`);
    return {
      success: true,
      domain: normalizedDomain,
      status: 'complete',
      companyResearch: existingResearch
    };
  }

  console.log(`[Research] Fetching enrichment data for domain: ${normalizedDomain}`);

  // Call enrichment API
  const enrichmentResult: EnrichmentResult = await clearbitClient.enrichCompany(normalizedDomain);

  if (!enrichmentResult.success) {
    console.log(`[Research] Enrichment failed for ${normalizedDomain}: ${enrichmentResult.error.message}`);

    // Return failure but don't crash
    return {
      success: false,
      domain: normalizedDomain,
      status: 'failed',
      companyResearch: null,
      error: enrichmentResult.error.message
    };
  }

  // Store the enrichment data
  const companyData = enrichmentResult.data;
  const companyResearch = await saveCompanyResearch(companyData);

  console.log(`[Research] Successfully enriched domain: ${normalizedDomain}`);

  return {
    success: true,
    domain: normalizedDomain,
    status: 'complete',
    companyResearch
  };
}

/**
 * Save company research data to database
 */
async function saveCompanyResearch(data: CompanyData): Promise<CompanyResearch> {
  return prisma.companyResearch.upsert({
    where: { domain: data.domain },
    update: {
      companyName: data.companyName,
      industry: data.industry,
      description: data.description,
      employeeCount: data.employeeCount,
      location: data.location,
      website: data.website,
      linkedinUrl: data.linkedinUrl,
      twitterUrl: data.twitterUrl,
      technologies: data.technologies,
      rawData: data.rawData as Prisma.InputJsonValue
    },
    create: {
      domain: data.domain,
      companyName: data.companyName,
      industry: data.industry,
      description: data.description,
      employeeCount: data.employeeCount,
      location: data.location,
      website: data.website,
      linkedinUrl: data.linkedinUrl,
      twitterUrl: data.twitterUrl,
      technologies: data.technologies,
      rawData: data.rawData as Prisma.InputJsonValue
    }
  });
}

/**
 * Get company research by domain (cache lookup only, no API call)
 */
export async function getCompanyResearch(domain: string): Promise<CompanyResearch | null> {
  const normalizedDomain = domain.toLowerCase().trim();

  return prisma.companyResearch.findUnique({
    where: { domain: normalizedDomain }
  });
}

/**
 * Update contact's research status
 */
export async function updateContactResearchStatus(
  contactId: string,
  status: ResearchStatus
): Promise<void> {
  await prisma.contact.update({
    where: { id: contactId },
    data: { researchStatus: status }
  });
}

/**
 * Research a contact by their company domain
 *
 * @param contactId - The contact's ID
 * @param domain - The company domain
 * @returns ResearchResult with company data
 */
export async function researchContactCompany(
  contactId: string,
  domain: string
): Promise<ResearchResult> {
  // Mark contact as processing
  await updateContactResearchStatus(contactId, 'processing');

  try {
    const result = await researchCompany(domain);

    // Update contact status based on result
    const newStatus = result.success ? 'complete' : 'failed';
    await updateContactResearchStatus(contactId, newStatus);

    return result;
  } catch (error) {
    // On unexpected error, mark as failed
    await updateContactResearchStatus(contactId, 'failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      domain,
      status: 'failed',
      companyResearch: null,
      error: `Research failed: ${errorMessage}`
    };
  }
}

/**
 * Get all pending research contacts for a user
 */
export async function getPendingResearchContacts(userId: string) {
  return prisma.contact.findMany({
    where: {
      userId,
      researchStatus: 'pending',
      companyDomain: { not: null }
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      companyDomain: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });
}

/**
 * Batch research multiple contacts
 *
 * @param contacts - Array of contacts with domains
 * @param concurrency - Max concurrent API calls (default 3)
 */
export async function batchResearchContacts(
  contacts: Array<{ id: string; companyDomain: string }>,
  concurrency = 3
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  // Process in batches to avoid rate limiting
  for (let i = 0; i < contacts.length; i += concurrency) {
    const batch = contacts.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(contact =>
        researchContactCompany(contact.id, contact.companyDomain)
      )
    );

    results.push(...batchResults);

    // Small delay between batches to be nice to the API
    if (i + concurrency < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get research statistics for a user
 */
export async function getResearchStats(userId: string) {
  const stats = await prisma.contact.groupBy({
    by: ['researchStatus'],
    where: { userId },
    _count: { id: true }
  });

  const result: Record<string, number> = {
    pending: 0,
    processing: 0,
    complete: 0,
    failed: 0,
    na: 0
  };

  for (const stat of stats) {
    result[stat.researchStatus] = stat._count.id;
  }

  return result;
}
