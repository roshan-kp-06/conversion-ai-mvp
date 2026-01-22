import axios from 'axios';
import type { AxiosError, AxiosInstance } from 'axios';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
  ProductContext,
  ProductContextInput,
  Contact,
  ContactInput,
  Email,
  GenerateEmailInput,
  RegenerateEmailInput,
  SaveEmailInput,
  EmailStats,
  PaginatedResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error: string }>) => {
        if (error.response?.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    // Load token from storage
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      this.token = storedToken;
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // ==================
  // Auth endpoints
  // ==================

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/v1/auth/login', credentials);
    this.setToken(response.data.token);
    return response.data;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/v1/auth/register', credentials);
    this.setToken(response.data.token);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<{ user: User }>('/api/v1/auth/me');
    return response.data.user;
  }

  logout() {
    this.clearToken();
  }

  // ==================
  // Product Context (Onboarding)
  // ==================

  async getProductContext(): Promise<ProductContext | null> {
    try {
      const response = await this.client.get<{ productContext: ProductContext }>('/api/v1/onboarding');
      return response.data.productContext;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createProductContext(data: ProductContextInput): Promise<ProductContext> {
    const response = await this.client.post<{ productContext: ProductContext }>('/api/v1/onboarding', data);
    return response.data.productContext;
  }

  async updateProductContext(data: Partial<ProductContextInput>): Promise<ProductContext> {
    const response = await this.client.patch<{ productContext: ProductContext }>('/api/v1/onboarding', data);
    return response.data.productContext;
  }

  // ==================
  // Contacts
  // ==================

  async getContacts(page = 1, limit = 20): Promise<PaginatedResponse<Contact>> {
    const response = await this.client.get<PaginatedResponse<Contact>>('/api/v1/contacts', {
      params: { page, limit },
    });
    return response.data;
  }

  async getContact(contactId: string): Promise<Contact> {
    const response = await this.client.get<Contact>(`/api/v1/contacts/${contactId}`);
    return response.data;
  }

  async createContact(data: ContactInput): Promise<Contact> {
    const response = await this.client.post<{ message: string; contact: Contact }>('/api/v1/contacts', data);
    return response.data.contact;
  }

  async updateContact(contactId: string, data: Partial<ContactInput>): Promise<Contact> {
    const response = await this.client.patch<{ message: string; contact: Contact }>(
      `/api/v1/contacts/${contactId}`,
      data
    );
    return response.data.contact;
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.client.delete(`/api/v1/contacts/${contactId}`);
  }

  async refreshContactResearch(contactId: string): Promise<Contact> {
    const response = await this.client.post<{ message: string; contact: Contact }>(
      `/api/v1/contacts/${contactId}/research`
    );
    return response.data.contact;
  }

  // ==================
  // Email Generation
  // ==================

  async generateEmail(data: GenerateEmailInput): Promise<Email> {
    const response = await this.client.post<{ message: string; email: Email }>('/api/v1/emails/generate', data);
    return response.data.email;
  }

  async regenerateEmail(data: RegenerateEmailInput): Promise<Email> {
    const response = await this.client.post<{ message: string; email: Email }>('/api/v1/emails/regenerate', data);
    return response.data.email;
  }

  async saveEmail(data: SaveEmailInput): Promise<Email> {
    const response = await this.client.post<{ message: string; email: Email }>('/api/v1/emails/save', data);
    return response.data.email;
  }

  // ==================
  // Email Management
  // ==================

  async getEmail(emailId: string): Promise<Email> {
    const response = await this.client.get<Email>(`/api/v1/emails/${emailId}`);
    return response.data;
  }

  async updateEmail(emailId: string, data: Partial<{ subject: string; bodyText: string; bodyHtml: string }>): Promise<Email> {
    const response = await this.client.patch<{ message: string; email: Email }>(`/api/v1/emails/${emailId}`, data);
    return response.data.email;
  }

  async deleteEmail(emailId: string): Promise<void> {
    await this.client.delete(`/api/v1/emails/${emailId}`);
  }

  async getContactEmails(contactId: string): Promise<Email[]> {
    const response = await this.client.get<{
      contactId: string;
      contactEmail: string;
      contactName: string | null;
      emails: Email[];
    }>(`/api/v1/emails/contact/${contactId}`);
    return response.data.emails;
  }

  // ==================
  // Email Sending
  // ==================

  async sendEmail(emailId: string): Promise<{ email: Email; mockMode: boolean }> {
    const response = await this.client.post<{
      message: string;
      email: Email;
      mockMode: boolean;
    }>(`/api/v1/emails/${emailId}/send`);
    return { email: response.data.email, mockMode: response.data.mockMode };
  }

  async sendBatchEmails(emailIds: string[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ emailId: string; success: boolean; error?: string }>;
  }> {
    const response = await this.client.post<{
      message: string;
      success: number;
      failed: number;
      results: Array<{ emailId: string; success: boolean; error?: string }>;
    }>('/api/v1/emails/send-batch', { emailIds });
    return {
      success: response.data.success,
      failed: response.data.failed,
      results: response.data.results,
    };
  }

  async getEmailStats(): Promise<EmailStats> {
    const response = await this.client.get<{ stats: EmailStats }>('/api/v1/emails/stats');
    return response.data.stats;
  }

  // ==================
  // Service Status
  // ==================

  async getEmailServiceStatus(): Promise<{
    aiGeneration: { ready: boolean; message: string };
    emailSending: { ready: boolean; fromEmail: { email: string; name: string }; message: string };
  }> {
    const response = await this.client.get('/api/v1/emails/status');
    return response.data;
  }
}

// Export singleton instance
export const api = new ApiClient();
