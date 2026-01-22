import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { ProductContext, ProductContextInput } from '../types';
import { Card, CardContent, CardHeader, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { AlertCircle, CheckCircle, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import type { AxiosError } from 'axios';

const steps = [
  { id: 1, title: 'Product Name', description: 'What is your product or service called?' },
  { id: 2, title: 'Description', description: 'Describe what your product does' },
  { id: 3, title: 'Target Audience', description: 'Who is your ideal customer?' },
  { id: 4, title: 'Pain Points', description: 'What problems does your product solve?' },
  { id: 5, title: 'Value Proposition', description: 'What makes your product unique?' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingContext, setExistingContext] = useState<ProductContext | null>(null);

  const [formData, setFormData] = useState<ProductContextInput>({
    productName: '',
    productDescription: '',
    targetAudience: '',
    painPoints: '',
    valueProposition: '',
  });

  useEffect(() => {
    loadProductContext();
  }, []);

  const loadProductContext = async () => {
    try {
      const context = await api.getProductContext();
      if (context) {
        setExistingContext(context);
        setFormData({
          productName: context.productName,
          productDescription: context.productDescription,
          targetAudience: context.targetAudience,
          painPoints: context.painPoints || '',
          valueProposition: context.valueProposition || '',
        });
      }
    } catch {
      // No existing context, that's fine
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProductContextInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 1:
        if (!formData.productName.trim()) {
          setError('Product name is required');
          return false;
        }
        break;
      case 2:
        if (!formData.productDescription.trim()) {
          setError('Product description is required');
          return false;
        }
        break;
      case 3:
        if (!formData.targetAudience.trim()) {
          setError('Target audience is required');
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      if (existingContext) {
        await api.updateProductContext(formData);
      } else {
        await api.createProductContext(formData);
      }
      setSuccess('Product context saved successfully!');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to save product context');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Input
            label="Product Name"
            value={formData.productName}
            onChange={(e) => handleInputChange('productName', e.target.value)}
            placeholder="e.g., Acme CRM, TechStartup Analytics"
            helperText="This will be used to personalize your emails"
          />
        );
      case 2:
        return (
          <Textarea
            label="Product Description"
            value={formData.productDescription}
            onChange={(e) => handleInputChange('productDescription', e.target.value)}
            placeholder="Describe what your product or service does and its main features..."
            helperText="Be specific about the benefits and capabilities"
            rows={4}
          />
        );
      case 3:
        return (
          <Textarea
            label="Target Audience"
            value={formData.targetAudience}
            onChange={(e) => handleInputChange('targetAudience', e.target.value)}
            placeholder="e.g., B2B SaaS companies with 10-100 employees, Marketing managers at enterprise companies..."
            helperText="Describe who would benefit most from your product"
            rows={4}
          />
        );
      case 4:
        return (
          <Textarea
            label="Pain Points (Optional)"
            value={formData.painPoints || ''}
            onChange={(e) => handleInputChange('painPoints', e.target.value)}
            placeholder="e.g., Manual data entry, lack of visibility into sales pipeline, difficulty tracking customer interactions..."
            helperText="What problems does your target audience face?"
            rows={4}
          />
        );
      case 5:
        return (
          <Textarea
            label="Value Proposition (Optional)"
            value={formData.valueProposition || ''}
            onChange={(e) => handleInputChange('valueProposition', e.target.value)}
            placeholder="e.g., Save 10 hours per week on data entry, increase close rates by 25%..."
            helperText="What unique value do you provide?"
            rows={4}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {existingContext ? 'Update Your Product Context' : 'Set Up Your Product Context'}
          </h1>
          <p className="text-gray-600 mt-1">
            This information helps us generate personalized cold emails
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-colors duration-200
                  ${
                    currentStep > step.id
                      ? 'bg-primary-600 text-white'
                      : currentStep === step.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }
                `}
              >
                {currentStep > step.id ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    currentStep > step.id ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              {steps[currentStep - 1].title}
            </h2>
            <p className="text-sm text-gray-600">
              {steps[currentStep - 1].description}
            </p>
          </CardHeader>

          <CardContent>
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

            {renderStepContent()}
          </CardContent>

          <CardFooter>
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>

              {currentStep < 5 ? (
                <Button
                  onClick={handleNext}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} isLoading={isSaving}>
                  {existingContext ? 'Update' : 'Complete Setup'}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Skip link */}
        {!existingContext && (
          <p className="text-center mt-4 text-sm text-gray-600">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-primary-600 hover:text-primary-700"
            >
              Skip for now
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
