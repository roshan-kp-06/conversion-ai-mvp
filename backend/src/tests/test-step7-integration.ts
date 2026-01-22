/**
 * Step 7 Integration Test: Email Sending
 *
 * Tests all functionality through Step 7:
 * - Steps 1-6: Database, Auth, Product Context, Contacts, Research, Email Generation
 * - Step 7: Email Sending (SendGrid integration with mock mode)
 *
 * Run with: npx ts-node src/tests/test-step7-integration.ts
 */

import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword, signToken, verifyToken } from '../lib/auth';
import { generateEmail, isAIServiceReady } from '../services/ai.service';
import {
  sendSavedEmail,
  sendBatchEmails,
  getEmailStats,
  getEmailServiceStatus,
} from '../services/email.service';
import { isSendGridConfigured, sendEmail } from '../lib/sendgrid';

// Test utilities
const testResults: { name: string; passed: boolean; error?: string }[] = [];

function log(message: string) {
  console.log(`[TEST] ${message}`);
}

function success(testName: string) {
  testResults.push({ name: testName, passed: true });
  console.log(`✅ ${testName}`);
}

function fail(testName: string, error: string) {
  testResults.push({ name: testName, passed: false, error });
  console.log(`❌ ${testName}: ${error}`);
}

// Cleanup function
async function cleanup() {
  log('Cleaning up test data...');

  // Delete in order due to foreign key constraints
  await prisma.email.deleteMany({
    where: { user: { email: { contains: 'step7test' } } }
  });
  await prisma.contact.deleteMany({
    where: { user: { email: { contains: 'step7test' } } }
  });
  await prisma.productContext.deleteMany({
    where: { user: { email: { contains: 'step7test' } } }
  });
  await prisma.user.deleteMany({
    where: { email: { contains: 'step7test' } }
  });

  log('Cleanup complete');
}

// ============================================
// STEP 1 TESTS: Database Connection
// ============================================

async function testDatabaseConnection() {
  const testName = 'Step 1: Database Connection';
  try {
    await prisma.$queryRaw`SELECT 1`;
    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================
// STEP 2 TESTS: Authentication
// ============================================

async function testPasswordHashing() {
  const testName = 'Step 2: Password Hashing';
  try {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);

    if (!hash || hash === password) {
      throw new Error('Hash should be different from password');
    }

    const isValid = await comparePassword(password, hash);
    if (!isValid) {
      throw new Error('Password verification failed');
    }

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testJWTTokens() {
  const testName = 'Step 2: JWT Token Generation/Verification';
  try {
    const userId = 'test-user-id-step7';
    const token = signToken({ userId });

    if (!token || token.split('.').length !== 3) {
      throw new Error('Invalid token format');
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.userId !== userId) {
      throw new Error('Token verification failed');
    }

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testUserRegistration() {
  const testName = 'Step 2: User Registration';
  try {
    const user = await prisma.user.create({
      data: {
        email: 'step7test@example.com',
        password: await hashPassword('TestPass123!'),
        name: 'Step 7 Test User'
      }
    });

    if (!user.id || !user.email) {
      throw new Error('User creation failed');
    }

    success(testName);
    return user;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// ============================================
// STEP 3 TESTS: Product Context
// ============================================

async function testProductContextCreation(userId: string) {
  const testName = 'Step 3: Product Context Creation';
  try {
    const context = await prisma.productContext.create({
      data: {
        userId,
        productName: 'Step 7 Test Product',
        productDescription: 'A comprehensive test product for email sending integration',
        targetAudience: 'Software developers and QA engineers',
        painPoints: 'Manual email testing is time-consuming and error-prone',
        valueProposition: 'Automated email testing with mock mode support and batch sending',
        tone: 'professional'
      }
    });

    if (!context.id) {
      throw new Error('Product context creation failed');
    }

    success(testName);
    return context;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// ============================================
// STEP 4 TESTS: Contacts
// ============================================

async function testContactCreation(userId: string) {
  const testName = 'Step 4: Contact Creation';
  try {
    const contact = await prisma.contact.create({
      data: {
        userId,
        email: 'contact-step7test@acme.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
        title: 'CTO'
      }
    });

    if (!contact.id || !contact.email) {
      throw new Error('Contact creation failed');
    }

    success(testName);
    return contact;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function testMultipleContacts(userId: string) {
  const testName = 'Step 4: Multiple Contacts for Batch Testing';
  try {
    const contacts = await Promise.all([
      prisma.contact.create({
        data: {
          userId,
          email: 'batch1-step7test@acme.com',
          firstName: 'Alice',
          lastName: 'Smith',
          company: 'Batch Corp'
        }
      }),
      prisma.contact.create({
        data: {
          userId,
          email: 'batch2-step7test@acme.com',
          firstName: 'Bob',
          lastName: 'Jones',
          company: 'Batch Corp'
        }
      })
    ]);

    if (contacts.length !== 2) {
      throw new Error('Multiple contact creation failed');
    }

    success(testName);
    return contacts;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

// ============================================
// STEP 5 TESTS: Company Research (Basic)
// ============================================

async function testContactWithResearchData(userId: string) {
  const testName = 'Step 5: Contact with Research Status';
  try {
    const contact = await prisma.contact.create({
      data: {
        userId,
        email: 'researched-step7test@techcorp.com',
        firstName: 'Jane',
        lastName: 'Wilson',
        company: 'Tech Corp',
        title: 'VP Engineering',
        companyDomain: 'techcorp.com',
        researchStatus: 'complete'
      }
    });

    if (!contact.id || contact.researchStatus !== 'complete') {
      throw new Error('Contact with research status creation failed');
    }

    success(testName);
    return contact;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// ============================================
// STEP 6 TESTS: Email Generation
// ============================================

async function testAIServiceStatus() {
  const testName = 'Step 6: AI Service Status Check';
  try {
    const ready = isAIServiceReady();
    // Just check it returns a boolean
    if (typeof ready !== 'boolean') {
      throw new Error('AI service status should return boolean');
    }
    success(testName);
    return ready;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testEmailGeneration(contactId: string, userId: string) {
  const testName = 'Step 6: Email Generation';
  try {
    const aiReady = isAIServiceReady();

    if (!aiReady) {
      log('  ⚠️  OpenAI not configured - testing error handling');
      const result = await generateEmail({ contactId, userId });
      if (result.success) {
        throw new Error('Should fail when AI not configured');
      }
      success(testName + ' (mock mode - error handling)');
      return null;
    }

    const result = await generateEmail({ contactId, userId });

    if (!result.success) {
      throw new Error(result.error || 'Email generation failed');
    }

    if (!result.email?.subject || !result.email?.bodyText) {
      throw new Error('Generated email missing required fields');
    }

    success(testName);
    return result.email;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function testEmailSaving(contactId: string, userId: string) {
  const testName = 'Step 6: Email Saving';
  try {
    const email = await prisma.email.create({
      data: {
        userId,
        contactId,
        subject: 'Step 7 Test Email Subject',
        bodyText: 'This is a test email body for Step 7 integration testing. It contains enough content to be meaningful.',
        bodyHtml: '<p>This is a test email body for Step 7 integration testing.</p>',
        status: 'draft'
      }
    });

    if (!email.id || email.status !== 'draft') {
      throw new Error('Email saving failed');
    }

    success(testName);
    return email;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// ============================================
// STEP 7 TESTS: Email Sending
// ============================================

async function testSendGridStatus() {
  const testName = 'Step 7: SendGrid Service Status';
  try {
    const configured = isSendGridConfigured();
    const serviceStatus = getEmailServiceStatus();

    if (typeof configured !== 'boolean') {
      throw new Error('SendGrid configured check should return boolean');
    }

    if (typeof serviceStatus.ready !== 'boolean') {
      throw new Error('Service status ready should be boolean');
    }

    if (!serviceStatus.fromEmail || !serviceStatus.fromEmail.email) {
      throw new Error('Service status should include from email');
    }

    log(`  SendGrid configured: ${configured}`);
    log(`  From email: ${serviceStatus.fromEmail.email}`);

    success(testName);
    return configured;
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testSendEmailMockMode() {
  const testName = 'Step 7: Send Email (Mock Mode)';
  try {
    const configured = isSendGridConfigured();

    if (configured) {
      log('  ⚠️  SendGrid is configured - skipping mock mode test');
      success(testName + ' (skipped - real SendGrid configured)');
      return;
    }

    const result = await sendEmail({
      to: 'test@example.com',
      toName: 'Test User',
      subject: 'Mock Test Email',
      text: 'This is a mock test email'
    });

    if (!result.success) {
      throw new Error('Mock email send should succeed');
    }

    if (!result.mockMode) {
      throw new Error('Should be in mock mode when SendGrid not configured');
    }

    if (!result.messageId || !result.messageId.startsWith('mock_')) {
      throw new Error('Mock message ID should start with mock_');
    }

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testSendSavedEmail(emailId: string, userId: string) {
  const testName = 'Step 7: Send Saved Email';
  try {
    const result = await sendSavedEmail({ emailId, userId });

    if (!result.success) {
      throw new Error(result.error || 'Send saved email failed');
    }

    if (!result.email) {
      throw new Error('Result should include email details');
    }

    if (result.email.status !== 'sent') {
      throw new Error(`Email status should be 'sent', got '${result.email.status}'`);
    }

    // Verify email was updated in database
    const updatedEmail = await prisma.email.findUnique({
      where: { id: emailId }
    });

    if (!updatedEmail || updatedEmail.status !== 'sent') {
      throw new Error('Email status not updated in database');
    }

    if (!updatedEmail.sentAt) {
      throw new Error('Email sentAt not set');
    }

    log(`  Mock mode: ${result.mockMode || false}`);
    log(`  Message ID: ${result.email.sendgridMessageId}`);

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testSendAlreadySentEmail(emailId: string, userId: string) {
  const testName = 'Step 7: Send Already Sent Email (Should Fail)';
  try {
    const result = await sendSavedEmail({ emailId, userId });

    if (result.success) {
      throw new Error('Should not allow sending already sent email');
    }

    if (!result.error?.includes('already been sent')) {
      throw new Error(`Expected 'already been sent' error, got: ${result.error}`);
    }

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testSendNonExistentEmail(userId: string) {
  const testName = 'Step 7: Send Non-Existent Email (Should Fail)';
  try {
    const result = await sendSavedEmail({
      emailId: 'non-existent-email-id',
      userId
    });

    if (result.success) {
      throw new Error('Should fail for non-existent email');
    }

    if (!result.error?.includes('not found')) {
      throw new Error(`Expected 'not found' error, got: ${result.error}`);
    }

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testBatchEmailSending(contactIds: string[], userId: string) {
  const testName = 'Step 7: Batch Email Sending';
  try {
    // Create emails for batch sending
    const emails = await Promise.all(
      contactIds.map((contactId, index) =>
        prisma.email.create({
          data: {
            userId,
            contactId,
            subject: `Batch Test Email ${index + 1}`,
            bodyText: `This is batch test email ${index + 1} for integration testing.`,
            status: 'draft'
          }
        })
      )
    );

    const emailIds = emails.map(e => e.id);

    const result = await sendBatchEmails(emailIds, userId);

    if (result.success !== emailIds.length) {
      throw new Error(`Expected ${emailIds.length} successful sends, got ${result.success}`);
    }

    if (result.failed !== 0) {
      throw new Error(`Expected 0 failures, got ${result.failed}`);
    }

    if (result.results.length !== emailIds.length) {
      throw new Error('Results array length mismatch');
    }

    // Verify all emails are marked as sent
    for (const emailId of emailIds) {
      const email = await prisma.email.findUnique({ where: { id: emailId } });
      if (email?.status !== 'sent') {
        throw new Error(`Email ${emailId} not marked as sent`);
      }
    }

    log(`  Sent: ${result.success}, Failed: ${result.failed}`);

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testEmailStats(userId: string) {
  const testName = 'Step 7: Email Statistics';
  try {
    const stats = await getEmailStats(userId);

    if (typeof stats.total !== 'number') {
      throw new Error('Stats should include total count');
    }

    if (typeof stats.sent !== 'number') {
      throw new Error('Stats should include sent count');
    }

    if (typeof stats.draft !== 'number') {
      throw new Error('Stats should include draft count');
    }

    log(`  Total: ${stats.total}`);
    log(`  Sent: ${stats.sent}`);
    log(`  Draft: ${stats.draft}`);
    log(`  Delivered: ${stats.delivered}`);
    log(`  Opened: ${stats.opened}`);
    log(`  Clicked: ${stats.clicked}`);
    log(`  Bounced: ${stats.bounced}`);
    log(`  Failed: ${stats.failed}`);

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testEmailStatusTransitions(contactId: string, userId: string) {
  const testName = 'Step 7: Email Status Transitions';
  try {
    // Create a draft email
    const email = await prisma.email.create({
      data: {
        userId,
        contactId,
        subject: 'Status Transition Test',
        bodyText: 'Testing status transitions from draft to sent.',
        status: 'draft'
      }
    });

    // Verify initial status
    if (email.status !== 'draft') {
      throw new Error('Initial status should be draft');
    }

    // Send the email
    const result = await sendSavedEmail({ emailId: email.id, userId });

    if (!result.success) {
      throw new Error(result.error || 'Send failed');
    }

    // Verify final status
    const sentEmail = await prisma.email.findUnique({ where: { id: email.id } });

    if (sentEmail?.status !== 'sent') {
      throw new Error(`Expected status 'sent', got '${sentEmail?.status}'`);
    }

    if (!sentEmail.sentAt) {
      throw new Error('sentAt should be set after sending');
    }

    log(`  Transition: draft → sent`);
    log(`  Sent at: ${sentEmail.sentAt}`);

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function testEmailWithMissingContact(userId: string) {
  const testName = 'Step 7: Email Without Contact Email (Should Fail)';
  try {
    // Create contact without email
    const contact = await prisma.contact.create({
      data: {
        userId,
        email: '', // Empty email
        firstName: 'No',
        lastName: 'Email'
      }
    });

    // Create email for this contact
    const email = await prisma.email.create({
      data: {
        userId,
        contactId: contact.id,
        subject: 'Test No Contact Email',
        bodyText: 'This should fail.',
        status: 'draft'
      }
    });

    const result = await sendSavedEmail({ emailId: email.id, userId });

    if (result.success) {
      throw new Error('Should fail when contact has no email');
    }

    if (!result.error?.includes('email address')) {
      throw new Error(`Expected 'email address' error, got: ${result.error}`);
    }

    success(testName);
  } catch (error) {
    fail(testName, error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================
// Main Test Runner
// ============================================

async function runAllTests() {
  console.log('\n========================================');
  console.log('  STEP 7 INTEGRATION TEST');
  console.log('  Email Sending Functionality');
  console.log('========================================\n');

  await cleanup();

  // Step 1: Database
  console.log('\n--- Step 1: Database Connection ---');
  await testDatabaseConnection();

  // Step 2: Authentication
  console.log('\n--- Step 2: Authentication ---');
  await testPasswordHashing();
  await testJWTTokens();
  const user = await testUserRegistration();

  if (!user) {
    console.log('\n❌ Cannot continue without user. Aborting.');
    await cleanup();
    process.exit(1);
  }

  // Step 3: Product Context
  console.log('\n--- Step 3: Product Context ---');
  await testProductContextCreation(user.id);

  // Step 4: Contacts
  console.log('\n--- Step 4: Contacts ---');
  const contact = await testContactCreation(user.id);
  const batchContacts = await testMultipleContacts(user.id);

  if (!contact) {
    console.log('\n❌ Cannot continue without contact. Aborting.');
    await cleanup();
    process.exit(1);
  }

  // Step 5: Company Research
  console.log('\n--- Step 5: Company Research ---');
  await testContactWithResearchData(user.id);

  // Step 6: Email Generation
  console.log('\n--- Step 6: Email Generation ---');
  await testAIServiceStatus();
  await testEmailGeneration(contact.id, user.id);
  const savedEmail = await testEmailSaving(contact.id, user.id);

  if (!savedEmail) {
    console.log('\n❌ Cannot continue without saved email. Aborting.');
    await cleanup();
    process.exit(1);
  }

  // Step 7: Email Sending
  console.log('\n--- Step 7: Email Sending ---');
  await testSendGridStatus();
  await testSendEmailMockMode();
  await testSendSavedEmail(savedEmail.id, user.id);
  await testSendAlreadySentEmail(savedEmail.id, user.id);
  await testSendNonExistentEmail(user.id);

  if (batchContacts.length > 0) {
    await testBatchEmailSending(batchContacts.map(c => c.id), user.id);
  }

  await testEmailStats(user.id);
  await testEmailStatusTransitions(contact.id, user.id);
  await testEmailWithMissingContact(user.id);

  // Cleanup
  await cleanup();

  // Summary
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================\n');

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log(`Total: ${testResults.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    testResults
      .filter(r => !r.passed)
      .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  }

  console.log('\n========================================\n');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(async (error) => {
  console.error('Test runner error:', error);
  await cleanup();
  await prisma.$disconnect();
  process.exit(1);
});
