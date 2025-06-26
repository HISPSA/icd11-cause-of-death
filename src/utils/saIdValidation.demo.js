/**
 * Demonstration of Real-time SA ID Validation
 * This file shows how the validation works step by step
 */

import { validateSAIdNumber, sanitizeSAIdInput } from './saIdValidation';

// Simulate real-time validation as user types
const simulateRealTimeValidation = () => {
  console.log('=== Real-time SA ID Validation Demo ===\n');
  
  const testInputs = [
    '',                    // Empty
    '8',                   // 1 digit
    '80',                  // 2 digits
    '800',                 // 3 digits
    '8001',                // 4 digits
    '80010',               // 5 digits
    '800101',              // 6 digits
    '8001015',             // 7 digits
    '80010150',            // 8 digits
    '800101500',           // 9 digits
    '8001015009',          // 10 digits
    '80010150090',         // 11 digits
    '800101500908',        // 12 digits
    '8001015009087',       // 13 digits - valid
    '8001015009088',       // 13 digits - invalid checksum
    '8001015009087abc',    // With non-numeric characters
    '8001325009087',       // Invalid date
  ];
  
  testInputs.forEach((input, index) => {
    console.log(`Step ${index + 1}: User types "${input}"`);
    
    // Simulate sanitization
    const sanitized = sanitizeSAIdInput(input);
    console.log(`  Sanitized: "${sanitized}"`);
    
    // Simulate real-time validation logic
    if (!sanitized || sanitized.trim() === '') {
      console.log('  Status: No input');
    } else if (sanitized.length < 13) {
      console.log(`  Status: Incomplete (${sanitized.length}/13 digits)`);
      console.log(`  Helper: "Please enter all 13 digits (${sanitized.length}/13)"`);
    } else if (sanitized.length === 13) {
      const validation = validateSAIdNumber(sanitized);
      if (validation.isValid) {
        console.log('  Status: ✓ Valid SA ID number');
        console.log('  Helper: "✓ Valid SA ID number" (green)');
      } else {
        console.log(`  Status: ✗ Invalid`);
        console.log(`  Error: "${validation.error}"`);
      }
    } else {
      console.log(`  Status: Too long (${sanitized.length} digits)`);
      console.log(`  Error: "SA ID number must be exactly 13 digits (current length: ${sanitized.length})"`);
    }
    
    console.log('---');
  });
};

// Run the demo
simulateRealTimeValidation();

export { simulateRealTimeValidation }; 