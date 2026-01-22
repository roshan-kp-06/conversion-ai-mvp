import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Contact, EmailStats } from '../types';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Mail,
  Users,
  Send,
  CheckCircle,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
  Sparkles,
  Building,
  AlertCircle,
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    loadStats();
    loadRecentContacts();
  }, []);

  const loadStats = async () => {
    try {
      const emailStats = await api.getEmailStats();
      setStats(emailStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStatsError('Failed to load email statistics');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadRecentContacts = async () => {
    try {
      const response = await api.getContacts(1, 5);
      setRecentContacts(response.data);
    } catch (error) {
      console.error('Failed to load recent contacts:', error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const statCards = [
    {
      title: 'Total Emails',
      value: stats?.total || 0,
      icon: Mail,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Sent',
      value: stats?.sent || 0,
      icon: Send,
      color: 'bg-green-500',
      lightColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Delivered',
      value: stats?.delivered || 0,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      lightColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      title: 'Drafts',
      value: stats?.draft || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      lightColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Overview of your email outreach performance
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/contacts')}
            leftIcon={<Users className="w-4 h-4" />}
          >
            View Contacts
          </Button>
          <Button
            onClick={() => navigate('/contacts')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {isLoadingStats ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      ) : statsError ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-600">{statsError}</p>
            <Button variant="outline" onClick={loadStats} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.lightColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Contacts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Contacts</h2>
              <Link
                to="/contacts"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
              >
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoadingContacts ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : recentContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No contacts yet</p>
                  <Button
                    onClick={() => navigate('/contacts')}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add Your First Contact
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {recentContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="py-3 flex items-center justify-between hover:bg-gray-50 -mx-4 px-4 cursor-pointer transition-colors"
                      onClick={() => navigate(`/contacts/${contact.id}/email`)}
                    >
                      <div className="flex items-center min-w-0">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-600 font-medium">
                            {(contact.firstName?.[0] || contact.email[0]).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {contact.firstName || contact.lastName
                              ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                              : contact.email}
                          </p>
                          <div className="flex items-center text-sm text-gray-500">
                            {contact.company && (
                              <>
                                <Building className="w-3 h-3 mr-1" />
                                <span className="truncate">{contact.company}</span>
                              </>
                            )}
                            {!contact.company && (
                              <span className="truncate">{contact.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            contact.researchStatus === 'complete'
                              ? 'bg-green-100 text-green-800'
                              : contact.researchStatus === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : contact.researchStatus === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {contact.researchStatus.replace('_', ' ')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/contacts/${contact.id}/email`);
                          }}
                        >
                          <Sparkles className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Quick Actions</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => navigate('/contacts')}
              >
                Add New Contact
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<Sparkles className="w-4 h-4" />}
                onClick={() => navigate('/contacts')}
              >
                Generate Email
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<TrendingUp className="w-4 h-4" />}
                onClick={() => navigate('/onboarding')}
              >
                Update Product Context
              </Button>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          {stats && stats.total > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Performance</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Sent Rate</span>
                      <span className="font-medium">
                        {Math.round((stats.sent / stats.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.round((stats.sent / stats.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {stats.delivered > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Delivery Rate</span>
                        <span className="font-medium">
                          {Math.round((stats.delivered / stats.sent) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.round((stats.delivered / stats.sent) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips Card */}
          <Card className="bg-primary-50 border-primary-200">
            <CardContent className="p-4">
              <div className="flex items-start">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Sparkles className="w-5 h-5 text-primary-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-medium text-primary-900">Pro Tip</h3>
                  <p className="text-sm text-primary-700 mt-1">
                    Add company and job title information to your contacts for
                    better AI-generated emails.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
