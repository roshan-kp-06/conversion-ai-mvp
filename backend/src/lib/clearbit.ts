/**
 * Clearbit/Apollo API Integration
 *
 * Provides company enrichment data from domain names.
 * Supports Clearbit API with fallback to mock data for development.
 */

import axios from 'axios';

// Types for company data
export interface CompanyData {
  domain: string;
  companyName: string | null;
  industry: string | null;
  description: string | null;
  employeeCount: string | null;
  location: string | null;
  website: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  technologies: string[];
  rawData: Record<string, unknown> | null;
}

export interface EnrichmentError {
  code: 'NOT_FOUND' | 'API_ERROR' | 'RATE_LIMITED' | 'INVALID_DOMAIN';
  message: string;
}

export type EnrichmentResult =
  | { success: true; data: CompanyData }
  | { success: false; error: EnrichmentError };

// Clearbit API response types (simplified)
interface ClearbitCompanyResponse {
  name: string | null;
  legalName: string | null;
  domain: string;
  domainAliases: string[];
  site: {
    phoneNumbers: string[];
    emailAddresses: string[];
  };
  category: {
    sector: string | null;
    industryGroup: string | null;
    industry: string | null;
    subIndustry: string | null;
  };
  tags: string[];
  description: string | null;
  foundedYear: number | null;
  location: string | null;
  geo: {
    streetNumber: string | null;
    streetName: string | null;
    subPremise: string | null;
    city: string | null;
    state: string | null;
    stateCode: string | null;
    postalCode: string | null;
    country: string | null;
    countryCode: string | null;
    lat: number | null;
    lng: number | null;
  };
  metrics: {
    alexaUsRank: number | null;
    alexaGlobalRank: number | null;
    employees: number | null;
    employeesRange: string | null;
    marketCap: number | null;
    raised: number | null;
    annualRevenue: number | null;
    estimatedAnnualRevenue: string | null;
    fiscalYearEnd: number | null;
  };
  linkedin: {
    handle: string | null;
  };
  twitter: {
    handle: string | null;
    id: string | null;
    bio: string | null;
    followers: number | null;
    following: number | null;
    location: string | null;
    site: string | null;
    avatar: string | null;
  };
  facebook: {
    handle: string | null;
  };
  tech: string[];
  techCategories: string[];
  parent: {
    domain: string | null;
  };
  ultimate_parent: {
    domain: string | null;
  };
}

/**
 * Clearbit Company Enrichment Client
 */
export class ClearbitClient {
  private apiKey: string | null;
  private baseUrl = 'https://company.clearbit.com/v2/companies';
  private useMock: boolean;

  constructor() {
    this.apiKey = process.env.CLEARBIT_API_KEY || null;

    // Detect placeholder API keys that shouldn't trigger real API calls
    const isPlaceholderKey = (key: string | null): boolean => {
      if (!key) return true;
      // Common placeholder patterns
      if (key.includes('your-') || key.includes('your_')) return true;
      if (key.includes('placeholder') || key.includes('example')) return true;
      if (key.startsWith('sk_test') || key.startsWith('test_')) return true;
      // Too short to be a real key
      if (key.length < 20) return true;
      return false;
    };

    // Use mock data if no API key, placeholder key, or explicitly in development mode
    this.useMock = !this.apiKey || isPlaceholderKey(this.apiKey) || process.env.USE_MOCK_ENRICHMENT === 'true';

    if (this.useMock) {
      console.log('[Clearbit] Running in mock mode (no valid API key or USE_MOCK_ENRICHMENT=true)');
    }
  }

  /**
   * Enrich company data by domain
   */
  async enrichCompany(domain: string): Promise<EnrichmentResult> {
    // Validate domain format
    if (!this.isValidDomain(domain)) {
      return {
        success: false,
        error: {
          code: 'INVALID_DOMAIN',
          message: `Invalid domain format: ${domain}`
        }
      };
    }

    // Use mock data in development
    if (this.useMock) {
      return this.getMockData(domain);
    }

    // Call Clearbit API
    return this.callClearbitApi(domain);
  }

  /**
   * Call the actual Clearbit API
   */
  private async callClearbitApi(domain: string): Promise<EnrichmentResult> {
    try {
      const response = await axios.get<ClearbitCompanyResponse>(
        `${this.baseUrl}/find?domain=${encodeURIComponent(domain)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      const data = response.data;

      return {
        success: true,
        data: this.transformClearbitResponse(domain, data)
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle specific HTTP errors
        if (error.response?.status === 404) {
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `No company data found for domain: ${domain}`
            }
          };
        }

        if (error.response?.status === 429) {
          return {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Clearbit API rate limit exceeded. Please try again later.'
            }
          };
        }

        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: {
              code: 'API_ERROR',
              message: 'Invalid or expired Clearbit API key'
            }
          };
        }
      }

      // Generic API error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: `Clearbit API error: ${errorMessage}`
        }
      };
    }
  }

  /**
   * Transform Clearbit response to our schema
   */
  private transformClearbitResponse(domain: string, data: ClearbitCompanyResponse): CompanyData {
    // Build location string from geo data
    let location: string | null = null;
    if (data.geo?.city || data.geo?.state || data.geo?.country) {
      const parts = [data.geo.city, data.geo.state, data.geo.country].filter(Boolean);
      location = parts.join(', ');
    }
    // Fallback to direct location field
    if (!location && data.location) {
      location = data.location;
    }

    // Build LinkedIn URL
    let linkedinUrl: string | null = null;
    if (data.linkedin?.handle) {
      linkedinUrl = `https://linkedin.com/company/${data.linkedin.handle}`;
    }

    // Build Twitter URL
    let twitterUrl: string | null = null;
    if (data.twitter?.handle) {
      twitterUrl = `https://twitter.com/${data.twitter.handle}`;
    }

    // Get industry (prefer most specific)
    const industry = data.category?.subIndustry
      || data.category?.industry
      || data.category?.industryGroup
      || data.category?.sector
      || null;

    return {
      domain,
      companyName: data.name || data.legalName || null,
      industry,
      description: data.description || null,
      employeeCount: data.metrics?.employeesRange || null,
      location,
      website: data.domain ? `https://${data.domain}` : null,
      linkedinUrl,
      twitterUrl,
      technologies: data.tech || [],
      rawData: data as unknown as Record<string, unknown>
    };
  }

  /**
   * Generate mock data for development/testing
   */
  private getMockData(domain: string): EnrichmentResult {
    // Simulate some domains not being found
    const notFoundDomains = ['unknown-domain.com', 'fake-company.xyz', 'test123.net'];
    if (notFoundDomains.some(d => domain.toLowerCase().includes(d))) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `[MOCK] No company data found for domain: ${domain}`
        }
      };
    }

    // Generate mock company data based on domain
    const companyName = this.domainToCompanyName(domain);
    const industries = [
      'Software', 'Technology', 'Financial Services', 'Healthcare',
      'Marketing', 'E-commerce', 'Education', 'Manufacturing'
    ];
    const employeeRanges = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000'];
    const techStacks = [
      ['React', 'Node.js', 'PostgreSQL', 'AWS'],
      ['Vue.js', 'Python', 'MongoDB', 'GCP'],
      ['Angular', 'Java', 'MySQL', 'Azure'],
      ['Next.js', 'TypeScript', 'Prisma', 'Vercel']
    ];
    const cities = ['San Francisco, CA, USA', 'New York, NY, USA', 'Austin, TX, USA', 'Seattle, WA, USA', 'Boston, MA, USA'];

    // Use domain hash for consistent mock data
    const hash = this.simpleHash(domain);

    return {
      success: true,
      data: {
        domain,
        companyName,
        industry: industries[hash % industries.length],
        description: `${companyName} is a leading provider of innovative solutions in the ${industries[hash % industries.length].toLowerCase()} space. They help businesses achieve their goals through cutting-edge technology and exceptional service.`,
        employeeCount: employeeRanges[hash % employeeRanges.length],
        location: cities[hash % cities.length],
        website: `https://${domain}`,
        linkedinUrl: `https://linkedin.com/company/${domain.split('.')[0]}`,
        twitterUrl: `https://twitter.com/${domain.split('.')[0]}`,
        technologies: techStacks[hash % techStacks.length],
        rawData: { _mock: true, _domain: domain }
      }
    };
  }

  /**
   * Convert domain to company name
   */
  private domainToCompanyName(domain: string): string {
    // Remove common TLDs and format
    const name = domain
      .replace(/\.(com|io|co|net|org|ai|app|dev|tech)$/i, '')
      .split('.')
      .pop() || domain;

    // Capitalize and format
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Simple hash function for consistent mock data
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }
}

// Export singleton instance
export const clearbitClient = new ClearbitClient();
