/**
 * South African ID Number Validation Utility
 * Validates SA ID numbers according to official specifications
 */

/**
 * Validates a South African ID number
 * @param {string} idNumber - The ID number to validate
 * @returns {Object} - Validation result with isValid boolean and error message
 */
export const validateSAIdNumber = (idNumber) => {
  // Default response
  const response = {
    isValid: false,
    error: null,
    details: {
      length: false,
      numeric: false,
      checksum: false,
      dateValid: false,
      genderValid: false,
      citizenshipValid: false
    }
  };

  // Check if ID number is provided
  if (!idNumber || idNumber.trim() === '') {
    response.error = 'SA ID number is required';
    return response;
  }

  // Check length (must be exactly 13 digits)
  if (idNumber.length !== 13) {
    response.error = `SA ID number must be exactly 13 digits (current length: ${idNumber.length})`;
    return response;
  }
  response.details.length = true;

  // Check if all characters are numeric
  if (!/^\d+$/.test(idNumber)) {
    response.error = 'SA ID number must contain only numeric digits';
    return response;
  }
  response.details.numeric = true;

  // Extract components
  const year = parseInt(idNumber.substring(0, 2));
  const month = parseInt(idNumber.substring(2, 4));
  const day = parseInt(idNumber.substring(4, 6));
  const genderSequence = parseInt(idNumber.substring(6, 10));
  const citizenship = parseInt(idNumber.substring(10, 11));

  // Validate date of birth
  // Get current year to determine century
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentYearInCentury = currentYear % 100;
  
  // Determine century for the birth year
  let fullYear;
  if (year <= currentYearInCentury) {
    // If the year is less than or equal to current year in century, use current century
    fullYear = currentCentury + year;
  } else {
    // If the year is greater than current year in century, use previous century
    fullYear = (currentCentury - 100) + year;
  }
  
  const date = new Date(fullYear, month - 1, day);
  
  if (date.getFullYear() !== fullYear || 
      date.getMonth() !== month - 1 || 
      date.getDate() !== day) {
    response.error = 'Invalid date of birth in SA ID number';
    return response;
  }
  response.details.dateValid = true;

  // Validate gender sequence (must be 0000-9999)
  if (genderSequence < 0 || genderSequence > 9999) {
    response.error = 'Invalid gender sequence in SA ID number';
    return response;
  }
  response.details.genderValid = true;

  // Validate citizenship digit (must be 0 or 1)
  if (citizenship !== 0 && citizenship !== 1) {
    response.error = 'Invalid citizenship digit in SA ID number';
    return response;
  }
  response.details.citizenshipValid = true;

  // Validate checksum using the correct SA algorithm
  if (!validateChecksum(idNumber)) {
    response.error = 'Invalid checksum - SA ID number appears to be incorrect';
    return response;
  }
  response.details.checksum = true;

  // All validations passed
  response.isValid = true;
  return response;
};

/**
 * Validates the checksum of a SA ID number using the correct SA algorithm
 * @param {string} idNumber - The 13-digit ID number
 * @returns {boolean} - True if checksum is valid
 */
const validateChecksum = (idNumber) => {
  // SA ID uses a specific algorithm, not standard Luhn
  // Take first 12 digits and calculate check digit
  const first12Digits = idNumber.substring(0, 12);
  const checkDigit = parseInt(idNumber.charAt(12));
  
  let sum = 0;
  
  // Process from left to right (positions 0-11)
  for (let i = 0; i < first12Digits.length; i++) {
    let digit = parseInt(first12Digits.charAt(i));
    
    // Double every second digit (odd positions: 1, 3, 5, 7, 9, 11)
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit = digit.toString().split('').reduce((a, b) => parseInt(a) + parseInt(b), 0);
      }
    }
    
    sum += digit;
  }
  
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return calculatedCheckDigit === checkDigit;
};

/**
 * Extracts date of birth from SA ID number
 * @param {string} idNumber - The 13-digit ID number
 * @returns {Object|null} - Object with year, month, day or null if invalid
 */
export const extractDateOfBirth = (idNumber) => {
  const validation = validateSAIdNumber(idNumber);
  
  if (!validation.isValid) {
    return null;
  }
  
  const year = parseInt(idNumber.substring(0, 2));
  const month = parseInt(idNumber.substring(2, 4));
  const day = parseInt(idNumber.substring(4, 6));
  
  // Get current year to determine century
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentYearInCentury = currentYear % 100;
  
  // Determine century for the birth year
  let fullYear;
  if (year <= currentYearInCentury) {
    // If the year is less than or equal to current year in century, use current century
    fullYear = currentCentury + year;
  } else {
    // If the year is greater than current year in century, use previous century
    fullYear = (currentCentury - 100) + year;
  }
  
  return {
    year: fullYear,
    month: month,
    day: day,
    formatted: `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  };
};

/**
 * Extracts gender from SA ID number
 * @param {string} idNumber - The 13-digit ID number
 * @returns {string|null} - 'Male' or 'Female' or null if invalid
 */
export const extractGender = (idNumber) => {
  const validation = validateSAIdNumber(idNumber);
  
  if (!validation.isValid) {
    return null;
  }
  
  // Extract the 4-digit gender sequence (positions 6-9)
  const genderSequence = parseInt(idNumber.substring(6, 10));
  
  // Females are assigned numbers in the range 0000-4999 and males from 5000-9999
  return genderSequence >= 5000 ? 'Male' : 'Female';
};

/**
 * Extracts citizenship from SA ID number
 * @param {string} idNumber - The 13-digit ID number
 * @returns {string|null} - 'SA Citizen' or 'Permanent Resident' or null if invalid
 */
export const extractCitizenship = (idNumber) => {
  const validation = validateSAIdNumber(idNumber);
  
  if (!validation.isValid) {
    return null;
  }
  
  const citizenship = parseInt(idNumber.substring(10, 11));
  return citizenship === 0 ? 'SA Citizen' : 'Permanent Resident';
};

/**
 * Formats SA ID number with spaces for better readability
 * @param {string} idNumber - The 13-digit ID number
 * @returns {string} - Formatted ID number (e.g., "800101 5009 087")
 */
export const formatSAIdNumber = (idNumber) => {
  if (!idNumber || idNumber.length !== 13) {
    return idNumber;
  }
  
  return `${idNumber.substring(0, 6)} ${idNumber.substring(6, 10)} ${idNumber.substring(10, 13)}`;
};

/**
 * Sanitizes input to only allow numeric characters and limit to 13 digits
 * @param {string} input - The input string
 * @returns {string} - Sanitized numeric string (max 13 digits)
 */
export const sanitizeSAIdInput = (input) => {
  if (!input) return '';
  
  // Remove all non-numeric characters
  const numericOnly = input.replace(/[^0-9]/g, '');
  
  // Limit to 13 digits
  return numericOnly.substring(0, 13);
}; 