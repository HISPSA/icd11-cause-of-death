/**
 * Test cases for SA ID Validation Utility
 * This file demonstrates how the validation utility works
 */

import { 
  validateSAIdNumber, 
  extractDateOfBirth, 
  extractGender, 
  extractCitizenship,
  formatSAIdNumber,
  sanitizeSAIdInput 
} from './saIdValidation';

// Test cases for validation
const testCases = [
  {
    id: '8001015009087',
    description: 'Valid SA ID number',
    expectedValid: true
  },
  {
    id: '8001015009088',
    description: 'Invalid checksum',
    expectedValid: false
  },
  {
    id: '800101500908',
    description: 'Too short (12 digits)',
    expectedValid: false
  },
  {
    id: '80010150090870',
    description: 'Too long (14 digits)',
    expectedValid: false
  },
  {
    id: '800101500908a',
    description: 'Contains non-numeric character',
    expectedValid: false
  },
  {
    id: '8001325009087',
    description: 'Invalid date (February 32nd)',
    expectedValid: false
  },
  {
    id: '8001015009087',
    description: 'Valid ID for testing extraction',
    expectedValid: true
  }
];

// Run tests
console.log('=== SA ID Validation Tests ===\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`ID: ${testCase.id}`);
  
  const result = validateSAIdNumber(testCase.id);
  
  console.log(`Valid: ${result.isValid}`);
  if (!result.isValid) {
    console.log(`Error: ${result.error}`);
  }
  console.log(`Details:`, result.details);
  console.log('---\n');
});

// Test extraction functions
console.log('=== Extraction Tests ===\n');

const validId = '8001015009087';
console.log(`Testing extraction with valid ID: ${validId}`);

const dob = extractDateOfBirth(validId);
console.log('Date of Birth:', dob);

const gender = extractGender(validId);
console.log('Gender:', gender);

const citizenship = extractCitizenship(validId);
console.log('Citizenship:', citizenship);

const formatted = formatSAIdNumber(validId);
console.log('Formatted:', formatted);

// Test sanitization
console.log('\n=== Sanitization Tests ===\n');

const sanitizeTests = [
  '800101 5009 087',
  '800101-5009-087',
  '8001015009087abc',
  '800101500908',
  '80010150090870'
];

sanitizeTests.forEach(test => {
  const sanitized = sanitizeSAIdInput(test);
  console.log(`Input: "${test}" -> Sanitized: "${sanitized}"`);
});

export { testCases }; 