import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Contact, Email } from '../types';
import { Card, CardContent, CardHeader, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  ArrowLeft,
  Mail,
  Sparkles,
  RefreshCw,
  Send,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Building,
  Briefcase,
  User,
} from 'lucide-react';
import type { AxiosError } from 'axios';

const toneOptions = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
] as const;

export function EmailGeneratorPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const [contact, setContact] = useState<Contact | null>(null);
  const [email, setEmail] = useState<Email | null>(null);
  const [previousEmails, setPreviousEmails] = useState<Email[]>([]);
  const [isLoadingContact, setIsLoadingContact] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedTone, setSelectedTone] = useState<typeof toneOptions[number]['value']>('professional');
  const [focusOn, setFocusOn] = useState('');

  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  useEffect(() => {
    if (contactId) {
      loadContact();
      loadPreviousEmails();
    }
  }, [contactId]);

  useEffect(() => {
    if (email) {
      setEditedSubject(email.subject);
      setEditedBody(email.bodyText);
    }
  }, [email]);

  const loadContact = async () => {
    try {
      const contactData = await api.getContact(contactId!);
      setContact(contactData);
    } catch (error) {
      console.error('Failed to load contact:', error);
      navigate('/contacts');
    } finally {
      setIsLoadingContact(false);
    }
  };

  const loadPreviousEmails = async () => {
    try {
      const emails = await api.getContactEmails(contactId!);
      setPreviousEmails(emails);
    } catch (error) {
      console.error('Failed to load previous emails:', error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    setSuccess('');

    try {
      const generatedEmail = await api.generateEmail({
        contactId: contactId!,
        customInstructions: customInstructions || undefined,
      });
      setEmail(generatedEmail);
      setSuccess('Email generated successfully!');
      loadPreviousEmails();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to generate email');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError('');
    setSuccess('');

    try {
      const regeneratedEmail = await api.regenerateEmail({
        contactId: contactId!,
        tone: selectedTone,
        focusOn: focusOn || undefined,
      });
      setEmail(regeneratedEmail);
      setSuccess('Email regenerated with new tone!');
      loadPreviousEmails();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to regenerate email');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (!email) return;
    setIsSaving(true);
    setError('');

    try {
      await api.updateEmail(email.id, {
        subject: editedSubject,
        bodyText: editedBody,
      });
      setEmail({ ...email, subject: editedSubject, bodyText: editedBody });
      setSuccess('Email saved!');
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to save email');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!email) return;

    // Save any edits first
    if (editedSubject !== email.subject || editedBody !== email.bodyText) {
      await handleSave();
    }

    setIsSending(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.sendEmail(email.id);
      setEmail(result.email);
      setSuccess(result.mockMode
        ? 'Email sent successfully! (Mock mode - check console)'
        : 'Email sent successfully!');
      loadPreviousEmails();
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy = `Subject: ${editedSubject}\n\n${editedBody}`;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoadingContact) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/contacts"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate Email</h1>
          <p className="text-gray-600">Create a personalized email for {contact.firstName || contact.email}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Contact info & Controls */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Contact Information</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-sm">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <span>{contact.email}</span>
              </div>
              {(contact.firstName || contact.lastName) && (
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  <span>{`${contact.firstName || ''} ${contact.lastName || ''}`.trim()}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center text-sm">
                  <Building className="w-4 h-4 mr-2 text-gray-400" />
                  <span>{contact.company}</span>
                </div>
              )}
              {contact.jobTitle && (
                <div className="flex items-center text-sm">
                  <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                  <span>{contact.jobTitle}</span>
                </div>
              )}

              {contact.researchData && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Research Data</p>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(contact.researchData, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generation Controls */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Generation Options</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Custom Instructions (Optional)"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., Focus on their recent product launch, mention we're in the same city..."
                rows={3}
              />

              <Button
                onClick={handleGenerate}
                isLoading={isGenerating}
                className="w-full"
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Generate Email
              </Button>

              {email && (
                <>
                  <hr className="my-4" />
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tone
                      </label>
                      <select
                        value={selectedTone}
                        onChange={(e) => setSelectedTone(e.target.value as typeof selectedTone)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {toneOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Input
                      label="Focus On (Optional)"
                      value={focusOn}
                      onChange={(e) => setFocusOn(e.target.value)}
                      placeholder="e.g., cost savings, efficiency"
                    />

                    <Button
                      onClick={handleRegenerate}
                      isLoading={isRegenerating}
                      variant="secondary"
                      className="w-full"
                      leftIcon={<RefreshCw className="w-4 h-4" />}
                    >
                      Regenerate with Options
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Email preview/editor */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {email ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="text-lg font-semibold">Email Preview</h2>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    email.status === 'sent' || email.status === 'delivered'
                      ? 'bg-green-100 text-green-800'
                      : email.status === 'draft'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {email.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Subject"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                />
                <Textarea
                  label="Body"
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleSave}
                    isLoading={isSaving}
                    disabled={editedSubject === email.subject && editedBody === email.bodyText}
                  >
                    Save Draft
                  </Button>
                  <Button
                    onClick={handleSend}
                    isLoading={isSending}
                    leftIcon={<Send className="w-4 h-4" />}
                    disabled={email.status === 'sent' || email.status === 'delivered'}
                  >
                    Send Email
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No email generated yet</h3>
                <p className="text-gray-600 mb-6">
                  Click "Generate Email" to create a personalized cold email for this contact
                </p>
                <Button
                  onClick={handleGenerate}
                  isLoading={isGenerating}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                >
                  Generate Email
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Previous Emails */}
          {previousEmails.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-lg font-semibold">Previous Emails ({previousEmails.length})</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {previousEmails.slice(0, 5).map((prevEmail) => (
                    <div
                      key={prevEmail.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        setEmail(prevEmail);
                        setEditedSubject(prevEmail.subject);
                        setEditedBody(prevEmail.bodyText);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{prevEmail.subject}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          prevEmail.status === 'sent' || prevEmail.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {prevEmail.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{prevEmail.bodyText.slice(0, 100)}...</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(prevEmail.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
