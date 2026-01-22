// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

// Auth types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
}

// Product Context types
export interface ProductContext {
  id: string;
  userId: string;
  productName: string;
  productDescription: string;
  targetAudience: string;
  painPoints: string | null;
  valueProposition: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductContextInput {
  productName: string;
  productDescription: string;
  targetAudience: string;
  painPoints?: string;
  valueProposition?: string;
}

// Contact types
export interface Contact {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  researchStatus: 'pending' | 'in_progress' | 'complete' | 'failed';
  researchData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  notes?: string;
}

// Email types
export type EmailStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

export interface Email {
  id: string;
  userId: string;
  contactId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  status: EmailStatus;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  sendgridMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
}

export interface GenerateEmailInput {
  contactId: string;
  customInstructions?: string;
}

export interface RegenerateEmailInput {
  contactId: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'formal' | 'enthusiastic';
  focusOn?: string;
}

export interface SaveEmailInput {
  contactId: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

// Email stats
export interface EmailStats {
  total: number;
  draft: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
}

// API Response wrappers
export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
