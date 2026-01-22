/**
 * Step 6 Integration Test
 *
 * Verifies all Step 6 components work together and all previous steps
 * are still functional.
 *
 * Tests:
 * 1. Database connection (Step 1)
 * 2. Auth flow - register, login (Step 2)
 * 3. Product context - save, retrieve (Step 3)
 * 4. Contacts CRUD with business/personal detection (Step 4)
 * 5. Auto-research triggers for business contacts (Step 5)
 * 6. AI email generation service (Step 6)
 * 7. Email CRUD operations (Step 6)
 */

import { prisma } from '../lib/prisma';
import { hashPassword, signToken, verifyToken, comparePassword } from '../lib/auth';
import { upsertProductContext, getProductContext } from '../services/productContext.service';
import { createContact, getContactById } from '../services/contacts.service';
import { isBusinessEmail } from '../lib/emailUtils';
import { generateEmail, regenerateEmail, isAIServiceReady } from '../services/ai.service';
import { isOpenAIConfigured } from '../lib/openai';

const TEST_USER_ID = 'test-user-step6-integration';
const TEST_USER_EMAIL = 'test-step6@example.com';
const TEST_PASSWORD = 'TestPassword123!';

async function setupTestUser() {
  const existingUser = await prisma.user.findUnique({
    where: { id: TEST_USER_ID }
  });

  if (!existingUser) {
    const hashedPassword = await hashPassword(TEST_PASSWORD);
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        password: hashedPassword,
        name: 'Step 6 Test User'
      }
    });
    console.log('Test user created');
  }
}

async function cleanup() {
  // Clean up in order of dependencies

  // 1. Delete emails for test user
  await prisma.email.deleteMany({
    where: { userId: TEST_USER_ID }
  });

  // 2. Get all contacts for test user
  const contacts = await prisma.contact.findMany({
    where: { userId: TEST_USER_ID }
  });

  // 3. Delete research records for test domains
  const domains = contacts.map(c => c.companyDomain).filter(Boolean) as string[];
  if (domains.length > 0) {
    await prisma.companyResearch.deleteMany({
      where: { domain: { in: domains } }
    });
  }

  // 4. Delete contacts
  await prisma.contact.deleteMany({
    where: { userId: TEST_USER_ID }
  });

  // 5. Delete product context
  await prisma.productContext.deleteMany({
    where: { userId: TEST_USER_ID }
  });
}

async function fullCleanup() {
  await cleanup();
  // Delete test user
  await prisma.user.deleteMany({
    where: { id: TEST_USER_ID }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('STEP 6 INTEGRATION TEST - Full System Verification');
  console.log('='.repeat(70));

  await setupTestUser();
  await cleanup();

  let passed = 0;
  let failed = 0;

  // =================================================================
  // STEP 1 TESTS: Database Connection
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 1: Database Connection');
  console.log('─'.repeat(70));

  // Test 1.1: Database connected
  try {
    const count = await prisma.user.count();
    console.log(`✅ Test 1.1 PASSED: Database connected (${count} users)`);
    passed++;
  } catch (error) {
    console.log('❌ Test 1.1 FAILED: Database connection error:', error);
    failed++;
  }

  // =================================================================
  // STEP 2 TESTS: Authentication
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 2: Authentication');
  console.log('─'.repeat(70));

  // Test 2.1: Password hashing works
  try {
    const hash = await hashPassword('testpassword');
    const matches = await comparePassword('testpassword', hash);
    const noMatch = await comparePassword('wrongpassword', hash);

    if (matches && !noMatch) {
      console.log('✅ Test 2.1 PASSED: Password hashing and comparison works');
      passed++;
    } else {
      console.log('❌ Test 2.1 FAILED: Password comparison incorrect');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 2.1 FAILED with error:', error);
    failed++;
  }

  // Test 2.2: JWT token signing and verification
  try {
    const token = signToken({ userId: TEST_USER_ID, email: TEST_USER_EMAIL });
    const decoded = verifyToken(token);

    if (decoded && decoded.userId === TEST_USER_ID) {
      console.log('✅ Test 2.2 PASSED: JWT sign and verify works');
      passed++;
    } else {
      console.log('❌ Test 2.2 FAILED: JWT verification returned wrong data');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 2.2 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // STEP 3 TESTS: Product Context
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 3: Product Context');
  console.log('─'.repeat(70));

  // Test 3.1: Save product context
  try {
    const context = await upsertProductContext(TEST_USER_ID, {
      productName: 'EmailGenius Pro',
      productDescription: 'AI-powered email generation platform for sales teams',
      targetAudience: 'B2B sales professionals and SDRs',
      painPoints: 'Time-consuming manual email writing, low response rates',
      valueProposition: 'Generate personalized emails 10x faster with AI',
      tone: 'professional'
    });

    if (context && context.productName === 'EmailGenius Pro') {
      console.log('✅ Test 3.1 PASSED: Product context saved');
      passed++;
    } else {
      console.log('❌ Test 3.1 FAILED: Product context not saved correctly');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 3.1 FAILED with error:', error);
    failed++;
  }

  // Test 3.2: Retrieve product context
  try {
    const context = await getProductContext(TEST_USER_ID);

    if (context && context.productName === 'EmailGenius Pro') {
      console.log('✅ Test 3.2 PASSED: Product context retrieved correctly');
      passed++;
    } else {
      console.log('❌ Test 3.2 FAILED: Product context not retrieved correctly');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 3.2 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // STEP 4 TESTS: Contacts & Email Detection
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 4: Contacts & Business Email Detection');
  console.log('─'.repeat(70));

  // Test 4.1: Business email detection
  try {
    const businessResult = isBusinessEmail('john@acme.com');
    const personalResult = isBusinessEmail('john@gmail.com');

    if (businessResult && !personalResult) {
      console.log('✅ Test 4.1 PASSED: Business email detection works');
      passed++;
    } else {
      console.log(`❌ Test 4.1 FAILED: acme.com=${businessResult}, gmail.com=${personalResult}`);
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 4.1 FAILED with error:', error);
    failed++;
  }

  // Test 4.2: Create business contact
  let businessContactId: string | null = null;
  try {
    const contact = await createContact(TEST_USER_ID, {
      email: 'contact@microsoft.com',
      firstName: 'Sarah',
      lastName: 'Johnson',
      title: 'VP of Sales',
      company: 'Microsoft'
    });

    businessContactId = contact.id;

    if (contact.isBusinessContact && contact.companyDomain === 'microsoft.com') {
      console.log('✅ Test 4.2 PASSED: Business contact created');
      passed++;
    } else {
      console.log('❌ Test 4.2 FAILED: Business contact flags incorrect');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 4.2 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // STEP 5 TESTS: Company Research
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 5: Company Research');
  console.log('─'.repeat(70));

  // Test 5.1: Wait for auto-research and verify
  console.log('Waiting 3 seconds for auto-research to complete...');
  await sleep(3000);

  try {
    if (businessContactId) {
      const contact = await getContactById(TEST_USER_ID, businessContactId);
      const research = await prisma.companyResearch.findUnique({
        where: { domain: 'microsoft.com' }
      });

      if (contact?.researchStatus === 'complete' && research) {
        console.log('✅ Test 5.1 PASSED: Auto-research completed');
        console.log('   Company:', research.companyName);
        console.log('   Industry:', research.industry);
        passed++;
      } else {
        console.log('❌ Test 5.1 FAILED: Auto-research not complete');
        console.log('   Contact status:', contact?.researchStatus);
        console.log('   Research exists:', !!research);
        failed++;
      }
    } else {
      console.log('❌ Test 5.1 SKIPPED: No business contact created');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 5.1 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // STEP 6 TESTS: AI Email Generation
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 6: AI Email Generation');
  console.log('─'.repeat(70));

  // Test 6.1: AI service readiness check
  try {
    const isReady = isAIServiceReady();
    const isConfigured = isOpenAIConfigured();

    console.log(`   OpenAI configured: ${isConfigured}`);
    console.log(`   AI service ready: ${isReady}`);

    if (isConfigured === isReady) {
      console.log('✅ Test 6.1 PASSED: AI service status consistent');
      passed++;
    } else {
      console.log('❌ Test 6.1 FAILED: AI service status inconsistent');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.1 FAILED with error:', error);
    failed++;
  }

  // Test 6.2: Email generation (or proper error without API key)
  try {
    if (businessContactId) {
      const result = await generateEmail({
        contactId: businessContactId,
        userId: TEST_USER_ID
      });

      if (isOpenAIConfigured()) {
        // API key is set - expect successful generation
        if (result.success && result.email) {
          console.log('✅ Test 6.2 PASSED: Email generated successfully');
          console.log('   Subject:', result.email.subject);
          console.log('   Body preview:', result.email.bodyText.substring(0, 100) + '...');
          passed++;
        } else {
          console.log('❌ Test 6.2 FAILED: Email generation failed');
          console.log('   Error:', result.error);
          failed++;
        }
      } else {
        // No API key - expect proper error
        if (!result.success && result.error?.includes('API key')) {
          console.log('✅ Test 6.2 PASSED: Proper error without API key');
          passed++;
        } else {
          console.log('❌ Test 6.2 FAILED: Unexpected error handling');
          failed++;
        }
      }
    } else {
      console.log('❌ Test 6.2 SKIPPED: No contact for email generation');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.2 FAILED with error:', error);
    failed++;
  }

  // Test 6.3: Regenerate email with options
  try {
    if (businessContactId) {
      const result = await regenerateEmail(businessContactId, TEST_USER_ID, {
        tone: 'friendly',
        focusOn: 'productivity benefits'
      });

      if (isOpenAIConfigured()) {
        if (result.success && result.email) {
          console.log('✅ Test 6.3 PASSED: Email regenerated with options');
          passed++;
        } else {
          console.log('❌ Test 6.3 FAILED:', result.error);
          failed++;
        }
      } else {
        if (!result.success && result.error?.includes('API key')) {
          console.log('✅ Test 6.3 PASSED: Proper error without API key');
          passed++;
        } else {
          console.log('❌ Test 6.3 FAILED: Unexpected error');
          failed++;
        }
      }
    } else {
      console.log('❌ Test 6.3 SKIPPED: No contact');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.3 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // STEP 6 TESTS: Email CRUD Operations
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 6: Email CRUD Operations');
  console.log('─'.repeat(70));

  // Test 6.4: Save email to database
  let savedEmailId: string | null = null;
  try {
    if (businessContactId) {
      const email = await prisma.email.create({
        data: {
          userId: TEST_USER_ID,
          contactId: businessContactId,
          subject: 'Test Email Subject',
          bodyText: 'This is a test email body for integration testing.',
          bodyHtml: '<div>This is a test email body for integration testing.</div>',
          status: 'draft'
        }
      });

      savedEmailId = email.id;

      if (email && email.subject === 'Test Email Subject') {
        console.log('✅ Test 6.4 PASSED: Email saved to database');
        passed++;
      } else {
        console.log('❌ Test 6.4 FAILED: Email not saved correctly');
        failed++;
      }
    } else {
      console.log('❌ Test 6.4 SKIPPED: No contact for email');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.4 FAILED with error:', error);
    failed++;
  }

  // Test 6.5: Retrieve email by ID
  try {
    if (savedEmailId) {
      const email = await prisma.email.findUnique({
        where: { id: savedEmailId },
        include: { contact: true }
      });

      if (email && email.contact && email.subject === 'Test Email Subject') {
        console.log('✅ Test 6.5 PASSED: Email retrieved by ID');
        passed++;
      } else {
        console.log('❌ Test 6.5 FAILED: Email not found or incorrect');
        failed++;
      }
    } else {
      console.log('❌ Test 6.5 SKIPPED: No email saved');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.5 FAILED with error:', error);
    failed++;
  }

  // Test 6.6: Get emails for contact
  try {
    if (businessContactId) {
      const emails = await prisma.email.findMany({
        where: {
          contactId: businessContactId,
          userId: TEST_USER_ID
        }
      });

      if (emails.length >= 1) {
        console.log(`✅ Test 6.6 PASSED: Found ${emails.length} email(s) for contact`);
        passed++;
      } else {
        console.log('❌ Test 6.6 FAILED: No emails found for contact');
        failed++;
      }
    } else {
      console.log('❌ Test 6.6 SKIPPED: No contact');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.6 FAILED with error:', error);
    failed++;
  }

  // Test 6.7: Update email
  try {
    if (savedEmailId) {
      const updated = await prisma.email.update({
        where: { id: savedEmailId },
        data: {
          subject: 'Updated Email Subject',
          status: 'sent'
        }
      });

      if (updated.subject === 'Updated Email Subject' && updated.status === 'sent') {
        console.log('✅ Test 6.7 PASSED: Email updated successfully');
        passed++;
      } else {
        console.log('❌ Test 6.7 FAILED: Email not updated correctly');
        failed++;
      }
    } else {
      console.log('❌ Test 6.7 SKIPPED: No email to update');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.7 FAILED with error:', error);
    failed++;
  }

  // Test 6.8: Delete email
  try {
    if (savedEmailId) {
      await prisma.email.delete({
        where: { id: savedEmailId }
      });

      const deleted = await prisma.email.findUnique({
        where: { id: savedEmailId }
      });

      if (!deleted) {
        console.log('✅ Test 6.8 PASSED: Email deleted successfully');
        passed++;
      } else {
        console.log('❌ Test 6.8 FAILED: Email still exists after delete');
        failed++;
      }
    } else {
      console.log('❌ Test 6.8 SKIPPED: No email to delete');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.8 FAILED with error:', error);
    failed++;
  }

  // Test 6.9: Error handling - non-existent contact
  try {
    const result = await generateEmail({
      contactId: 'non-existent-contact-id',
      userId: TEST_USER_ID
    });

    if (!result.success && result.error?.includes('not found')) {
      console.log('✅ Test 6.9 PASSED: Proper error for non-existent contact');
      passed++;
    } else if (!isOpenAIConfigured() && result.error?.includes('API key')) {
      console.log('✅ Test 6.9 PASSED: API key error takes precedence (expected)');
      passed++;
    } else {
      console.log('❌ Test 6.9 FAILED: Unexpected result');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 6.9 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // CLEANUP & SUMMARY
  // =================================================================
  await fullCleanup();

  console.log('\n' + '='.repeat(70));
  console.log(`STEP 6 INTEGRATION TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED - Step 6 Integration Complete!');
    console.log('\nVerified components:');
    console.log('  • Step 1: Database connection');
    console.log('  • Step 2: Authentication (password hashing, JWT)');
    console.log('  • Step 3: Product context (save, retrieve)');
    console.log('  • Step 4: Contacts with business email detection');
    console.log('  • Step 5: Company research auto-trigger');
    console.log('  • Step 6: AI email generation service');
    console.log('  • Step 6: Email CRUD operations');
  } else {
    console.log('\n❌ SOME TESTS FAILED - Please review the failures above');
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
