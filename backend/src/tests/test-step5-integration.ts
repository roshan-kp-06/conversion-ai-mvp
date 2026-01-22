/**
 * Step 5 Integration Test
 *
 * Verifies all Step 5 components work together and all previous steps
 * are still functional.
 *
 * Tests:
 * 1. Database connection (Step 1)
 * 2. Auth flow - register, login (Step 2)
 * 3. Product context - save, retrieve (Step 3)
 * 4. Contacts CRUD with business/personal detection (Step 4)
 * 5. Auto-research triggers for business contacts (Step 5)
 */

import { prisma } from '../lib/prisma';
import { hashPassword, signToken, verifyToken, comparePassword } from '../lib/auth';
import { upsertProductContext, getProductContext } from '../services/productContext.service';
import { createContact, getContactsByUserId, getContactById, deleteContact } from '../services/contacts.service';
import { isBusinessEmail, extractDomain } from '../lib/emailUtils';
import { researchCompany } from '../services/research.service';

const TEST_USER_ID = 'test-user-step5-integration';
const TEST_USER_EMAIL = 'test-step5@example.com';
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
        name: 'Step 5 Test User'
      }
    });
    console.log('Test user created');
  }
}

async function cleanup() {
  // Clean up in order of dependencies

  // 1. Get all contacts for test user
  const contacts = await prisma.contact.findMany({
    where: { userId: TEST_USER_ID }
  });

  // 2. Delete research records for test domains
  const domains = contacts.map(c => c.companyDomain).filter(Boolean) as string[];
  if (domains.length > 0) {
    await prisma.companyResearch.deleteMany({
      where: { domain: { in: domains } }
    });
  }

  // 3. Delete contacts
  await prisma.contact.deleteMany({
    where: { userId: TEST_USER_ID }
  });

  // 4. Delete product context
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
  console.log('STEP 5 INTEGRATION TEST - Full System Verification');
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

  // Test 2.3: User can be fetched from database
  try {
    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID }
    });

    if (user && user.email === TEST_USER_EMAIL) {
      console.log('✅ Test 2.3 PASSED: User fetched from database');
      passed++;
    } else {
      console.log('❌ Test 2.3 FAILED: User not found or email mismatch');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 2.3 FAILED with error:', error);
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
      productName: 'Test Product',
      productDescription: 'A test product for integration testing',
      targetAudience: 'Developers',
      painPoints: 'Slow development cycles, complex deployments',
      valueProposition: 'Faster development with AI-powered tools',
      tone: 'professional'
    });

    if (context && context.productName === 'Test Product') {
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

    if (context && context.productName === 'Test Product' && context.targetAudience === 'Developers') {
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

  // Test 4.2: Domain extraction
  try {
    const domain = extractDomain('user@company.io');

    if (domain === 'company.io') {
      console.log('✅ Test 4.2 PASSED: Domain extraction works');
      passed++;
    } else {
      console.log(`❌ Test 4.2 FAILED: Expected 'company.io', got '${domain}'`);
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 4.2 FAILED with error:', error);
    failed++;
  }

  // Test 4.3: Create business contact
  let businessContactId: string | null = null;
  try {
    const contact = await createContact(TEST_USER_ID, {
      email: 'contact@microsoft.com',
      firstName: 'Test',
      lastName: 'Contact'
    });

    businessContactId = contact.id;

    if (contact.isBusinessContact && contact.companyDomain === 'microsoft.com' && contact.researchStatus === 'pending') {
      console.log('✅ Test 4.3 PASSED: Business contact created with correct flags');
      passed++;
    } else {
      console.log('❌ Test 4.3 FAILED:', {
        isBusinessContact: contact.isBusinessContact,
        companyDomain: contact.companyDomain,
        researchStatus: contact.researchStatus
      });
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 4.3 FAILED with error:', error);
    failed++;
  }

  // Test 4.4: Create personal contact
  let personalContactId: string | null = null;
  try {
    const contact = await createContact(TEST_USER_ID, {
      email: 'personal@hotmail.com',
      firstName: 'Personal',
      lastName: 'User'
    });

    personalContactId = contact.id;

    if (!contact.isBusinessContact && !contact.companyDomain && contact.researchStatus === 'na') {
      console.log('✅ Test 4.4 PASSED: Personal contact created with correct flags');
      passed++;
    } else {
      console.log('❌ Test 4.4 FAILED:', {
        isBusinessContact: contact.isBusinessContact,
        companyDomain: contact.companyDomain,
        researchStatus: contact.researchStatus
      });
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 4.4 FAILED with error:', error);
    failed++;
  }

  // Test 4.5: List contacts
  try {
    const contacts = await getContactsByUserId(TEST_USER_ID);

    if (contacts.length === 2) {
      console.log('✅ Test 4.5 PASSED: Contact list returns correct count');
      passed++;
    } else {
      console.log(`❌ Test 4.5 FAILED: Expected 2 contacts, got ${contacts.length}`);
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 4.5 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // STEP 5 TESTS: Company Research
  // =================================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 5: Company Research');
  console.log('─'.repeat(70));

  // Test 5.1: Research service works
  try {
    const result = await researchCompany('google.com');

    if (result.success && result.companyResearch) {
      console.log('✅ Test 5.1 PASSED: Research service returns data');
      console.log('   Company:', result.companyResearch.companyName);
      console.log('   Industry:', result.companyResearch.industry);
      passed++;
    } else {
      console.log('❌ Test 5.1 FAILED: Research service failed');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 5.1 FAILED with error:', error);
    failed++;
  }

  // Test 5.2: Auto-research triggered (wait for async completion)
  console.log('\nWaiting 3 seconds for auto-research to complete...');
  await sleep(3000);

  try {
    if (businessContactId) {
      const contact = await getContactById(TEST_USER_ID, businessContactId);
      const research = await prisma.companyResearch.findUnique({
        where: { domain: 'microsoft.com' }
      });

      if (contact?.researchStatus === 'complete' && research) {
        console.log('✅ Test 5.2 PASSED: Auto-research completed');
        console.log('   Research data:', {
          domain: research.domain,
          companyName: research.companyName,
          industry: research.industry
        });
        passed++;
      } else {
        console.log('❌ Test 5.2 FAILED: Auto-research not complete');
        console.log('   Contact status:', contact?.researchStatus);
        console.log('   Research exists:', !!research);
        failed++;
      }
    } else {
      console.log('❌ Test 5.2 SKIPPED: No business contact created');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 5.2 FAILED with error:', error);
    failed++;
  }

  // Test 5.3: Research data persisted to database
  try {
    const research = await prisma.companyResearch.findUnique({
      where: { domain: 'microsoft.com' }
    });

    if (research && research.companyName && research.industry) {
      console.log('✅ Test 5.3 PASSED: Research data persisted correctly');
      passed++;
    } else {
      console.log('❌ Test 5.3 FAILED: Research data incomplete or missing');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 5.3 FAILED with error:', error);
    failed++;
  }

  // Test 5.4: Delete contact (cleanup test)
  try {
    if (personalContactId) {
      const deleted = await deleteContact(TEST_USER_ID, personalContactId);

      if (deleted) {
        console.log('✅ Test 5.4 PASSED: Contact deleted successfully');
        passed++;
      } else {
        console.log('❌ Test 5.4 FAILED: Delete returned false');
        failed++;
      }
    } else {
      console.log('❌ Test 5.4 SKIPPED: No personal contact to delete');
      failed++;
    }
  } catch (error) {
    console.log('❌ Test 5.4 FAILED with error:', error);
    failed++;
  }

  // =================================================================
  // CLEANUP & SUMMARY
  // =================================================================
  await fullCleanup();

  console.log('\n' + '='.repeat(70));
  console.log(`STEP 5 INTEGRATION TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED - Step 5 Integration Complete!');
    console.log('\nVerified components:');
    console.log('  • Step 1: Database connection');
    console.log('  • Step 2: Authentication (password hashing, JWT)');
    console.log('  • Step 3: Product context (save, retrieve)');
    console.log('  • Step 4: Contacts CRUD with business/personal detection');
    console.log('  • Step 5: Company research auto-trigger and persistence');
  } else {
    console.log('\n❌ SOME TESTS FAILED - Please review the failures above');
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
