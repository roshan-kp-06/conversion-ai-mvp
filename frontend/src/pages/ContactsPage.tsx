import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Contact, ContactInput } from '../types';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Plus,
  Search,
  Mail,
  Building,
  Briefcase,
  RefreshCw,
  Trash2,
  X,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AxiosError } from 'axios';

const researchStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  complete: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [refreshingContactId, setRefreshingContactId] = useState<string | null>(null);

  const limit = 10;

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getContacts(page, limit);
      setContacts(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleRefreshResearch = async (contactId: string) => {
    setRefreshingContactId(contactId);
    try {
      const updatedContact = await api.refreshContactResearch(contactId);
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? updatedContact : c))
      );
    } catch (error) {
      console.error('Failed to refresh research:', error);
    } finally {
      setRefreshingContactId(null);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    setDeletingContactId(contactId);
    try {
      await api.deleteContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error('Failed to delete contact:', error);
    } finally {
      setDeletingContactId(null);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = search.toLowerCase();
    return (
      contact.email.toLowerCase().includes(searchLower) ||
      (contact.firstName?.toLowerCase().includes(searchLower) ?? false) ||
      (contact.lastName?.toLowerCase().includes(searchLower) ?? false) ||
      (contact.company?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600 mt-1">Manage your contacts and generate personalized emails</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add Contact
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="pl-10"
        />
      </div>

      {/* Contacts list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
            <p className="text-gray-600 mb-4">Add your first contact to get started</p>
            <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Add Contact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900 truncate">
                        {contact.firstName || contact.lastName
                          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                          : contact.email}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          researchStatusColors[contact.researchStatus]
                        }`}
                      >
                        {contact.researchStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-1" />
                        {contact.email}
                      </div>
                      {contact.company && (
                        <div className="flex items-center">
                          <Building className="w-4 h-4 mr-1" />
                          {contact.company}
                        </div>
                      )}
                      {contact.jobTitle && (
                        <div className="flex items-center">
                          <Briefcase className="w-4 h-4 mr-1" />
                          {contact.jobTitle}
                        </div>
                      )}
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-primary-600 hover:text-primary-700"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshResearch(contact.id)}
                      isLoading={refreshingContactId === contact.id}
                      title="Refresh research"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/contacts/${contact.id}/email`)}
                    >
                      Generate Email
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingContact(contact)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteContact(contact.id)}
                      isLoading={deletingContactId === contact.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} contacts
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingContact) && (
        <ContactModal
          contact={editingContact}
          onClose={() => {
            setShowAddModal(false);
            setEditingContact(null);
          }}
          onSave={(savedContact) => {
            if (editingContact) {
              setContacts((prev) =>
                prev.map((c) => (c.id === savedContact.id ? savedContact : c))
              );
            } else {
              setContacts((prev) => [savedContact, ...prev]);
              setTotal((prev) => prev + 1);
            }
            setShowAddModal(false);
            setEditingContact(null);
          }}
        />
      )}
    </div>
  );
}

interface ContactModalProps {
  contact: Contact | null;
  onClose: () => void;
  onSave: (contact: Contact) => void;
}

function ContactModal({ contact, onClose, onSave }: ContactModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<ContactInput>({
    email: contact?.email || '',
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    company: contact?.company || '',
    jobTitle: contact?.jobTitle || '',
    linkedinUrl: contact?.linkedinUrl || '',
    notes: contact?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let savedContact: Contact;
      if (contact) {
        savedContact = await api.updateContact(contact.id, formData);
      } else {
        savedContact = await api.createContact(formData);
      }
      onSave(savedContact);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to save contact');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold">
            {contact ? 'Edit Contact' : 'Add New Contact'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@company.com"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
              />
              <Input
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>

            <Input
              label="Company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Acme Inc."
            />

            <Input
              label="Job Title"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              placeholder="CEO"
            />

            <Input
              label="LinkedIn URL"
              value={formData.linkedinUrl}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/johndoe"
            />

            <Textarea
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about this contact..."
              rows={3}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {contact ? 'Save Changes' : 'Add Contact'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
