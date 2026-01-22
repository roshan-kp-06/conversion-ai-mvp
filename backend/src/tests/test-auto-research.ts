/**
 * Test: Auto-Research on Contact Creation (Task 5.2)
 *
 * Verifies that creating a business contact automatically triggers
 * company research in the background.
 */

import { prisma } from '../lib/prisma';
import { createContact, getContactById } from '../services/contacts.service';

const TEST_USER_ID = 'test-user-auto-research';
const TEST_USER_EMAIL = 'test-auto-research@example.com';

async function setupTestUser() {
  // Create test user if doesn't exist
  const existingUser = await prisma.user.findUnique({
    where: { id: TEST_USER_ID }
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        password: '$2b$10$test-password-hash', // Dummy hash
        name: 'Test User'
      }
    });
    console.log('Test user created');
  }
}

async function cleanup() {
  // Clean up test contacts first
  const contacts = await prisma.contact.findMany({
    where: { userId: TEST_USER_ID }
  });

  // Delete research records for test domains
  const domains = contacts.map(c => c.companyDomain).filter(Boolean) as string[];
  if (domains.length > 0) {
    await prisma.companyResearch.deleteMany({
      where: { domain: { in: domains } }
    });
  }

  // Delete contacts
  await prisma.contact.deleteMany({
    where: { userId: TEST_USER_ID }
  });
}

async function fullCleanup() {
  await cleanup();
  // Also delete test user
  await prisma.user.deleteMany({
    where: { id: TEST_USER_ID }
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Task 5.2: Auto-Research on Contact Creation Tests');
  console.log('='.repeat(60));

  // Setup test user
  await setupTestUser();
  await cleanup();

  let passed = 0;
  let failed = 0;

  // Test 1: Business contact triggers auto-research
  console.log('\n--- Test 1: Business contact triggers auto-research ---');
  try {
    const contact = await createContact(TEST_USER_ID, {
      email: 'ceo@stripe.com',
      firstName: 'Patrick',
      lastName: 'Collison',
      title: 'CEO'
    });

    console.log('Contact created:', {
      id: contact.id,
      email: contact.email,
      isBusinessContact: contact.isBusinessContact,
      researchStatus: contact.researchStatus,
      companyDomain: contact.companyDomain
    });

    // Initial status should be 'pending' (research triggered but not complete yet)
    if (contact.researchStatus === 'pending' && contact.isBusinessContact) {
      console.log('✅ Test 1 PASSED: Business contact created with pending research');
      passed++;
    } else {
      console.log('❌ Test 1 FAILED: Expected pending status for business contact');
      failed++;
    }

    // Wait for async research to complete (mock should be fast)
    console.log('\nWaiting 2 seconds for async research to complete...');
    await sleep(2000);

    // Check if research completed
    const updatedContact = await getContactById(TEST_USER_ID, contact.id);
    console.log('After waiting:', {
      researchStatus: updatedContact?.researchStatus
    });

    // Check if company research record was created (query by domain)
    if (contact.companyDomain) {
      const research = await prisma.companyResearch.findUnique({
        where: { domain: contact.companyDomain }
      });

      if (research) {
        console.log('Research record found:', {
          domain: research.domain,
          companyName: research.companyName,
          industry: research.industry
        });
      }
    }

  } catch (error) {
    console.log('❌ Test 1 FAILED with error:', error);
    failed++;
  }

  // Test 2: Personal contact does NOT trigger research
  console.log('\n--- Test 2: Personal contact does NOT trigger research ---');
  try {
    const contact = await createContact(TEST_USER_ID, {
      email: 'john.doe@gmail.com',
      firstName: 'John',
      lastName: 'Doe'
    });

    console.log('Contact created:', {
      id: contact.id,
      email: contact.email,
      isBusinessContact: contact.isBusinessContact,
      researchStatus: contact.researchStatus,
      companyDomain: contact.companyDomain
    });

    // Personal contact should have 'na' status (not applicable)
    if (contact.researchStatus === 'na' && !contact.isBusinessContact) {
      console.log('✅ Test 2 PASSED: Personal contact has na research status');
      passed++;
    } else {
      console.log('❌ Test 2 FAILED: Expected na status for personal contact');
      failed++;
    }

    // companyDomain should be null for personal email
    if (!contact.companyDomain) {
      console.log('✅ No companyDomain set for personal contact (correct)');
    } else {
      console.log('⚠️ Unexpected: companyDomain found for personal contact');
    }

  } catch (error) {
    console.log('❌ Test 2 FAILED with error:', error);
    failed++;
  }

  // Test 3: Verify research data is stored correctly
  console.log('\n--- Test 3: Verify research data stored correctly ---');
  try {
    const contact = await createContact(TEST_USER_ID, {
      email: 'sales@acme.com',
      firstName: 'Sales',
      lastName: 'Team'
    });

    console.log('Contact created:', {
      id: contact.id,
      email: contact.email,
      companyDomain: contact.companyDomain
    });

    // Wait for research to complete
    console.log('Waiting 2 seconds for research...');
    await sleep(2000);

    // Verify research data (query by domain)
    if (contact.companyDomain) {
      const research = await prisma.companyResearch.findUnique({
        where: { domain: contact.companyDomain }
      });

      if (research && research.companyName && research.industry) {
        console.log('✅ Test 3 PASSED: Research data stored correctly');
        console.log('Research data:', {
          domain: research.domain,
          companyName: research.companyName,
          industry: research.industry,
          employeeCount: research.employeeCount,
          location: research.location
        });
        passed++;
      } else {
        console.log('❌ Test 3 FAILED: Research data incomplete or missing');
        console.log('Research:', research);
        failed++;
      }
    } else {
      console.log('❌ Test 3 FAILED: No companyDomain for business contact');
      failed++;
    }

    // Check contact status updated
    const updatedContact = await getContactById(TEST_USER_ID, contact.id);
    console.log('Contact research status:', updatedContact?.researchStatus);

  } catch (error) {
    console.log('❌ Test 3 FAILED with error:', error);
    failed++;
  }

  // Full cleanup (including test user)
  await fullCleanup();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  await prisma.$disconnect();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
