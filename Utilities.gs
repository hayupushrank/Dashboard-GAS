/**
 * Utilities.gs - Server-Side Utility Helpers
 * This file acts as a "toolbox" containing small, reusable helper functions 
 * that clean, format, and safely convert data before it gets sent to your dashboard UI.
 */

/**
 * Parses and normalizes various date formats into standard YYYY-MM-DD strings.
 * Google Sheets can return dates as actual Date objects, text strings, or serial numbers; 
 * this function ensures they all look uniform.
 */
function formatDateISO(dateVal) {
  // If the date value is empty/null, return an empty string
  if (!dateVal) return '';
  
  // Try to convert the input into a JavaScript Date object
  var d = new Date(dateVal);
  
  // If it's not a valid date (e.g. random text), just return the trimmed text as-is
  if (isNaN(d.getTime())) return String(dateVal).trim();
  
  // Extract the 4-digit year
  var year = d.getFullYear();
  
  // Extract the month (JavaScript months are 0-indexed: January is 0, so we add 1).
  // ('0' + ...) adds a leading zero, and .slice(-2) keeps only the last 2 characters 
  // (e.g., '0' + 3 becomes '03', but '0' + 12 becomes '012' which slices to '12').
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  
  // Extract the day of the month, padded with a leading zero if needed
  var day = ('0' + d.getDate()).slice(-2);
  
  // Combine them into a clean ISO string format (YYYY-MM-DD)
  return year + '-' + month + '-' + day;
}

/**
 * Sanitizes numeric input from spreadsheet cells.
 * Spreadsheet cells can sometimes contain blank spaces, null values, or accidental text. 
 * This prevents math errors (like returning NaN) on your dashboard.
 */
function parseNumber(val) {
  // If the value is completely empty, null, or undefined, safely default to 0
  if (val === null || val === undefined || val === '') return 0;
  
  // Attempt to convert the value into a number
  var num = Number(val);
  
  // If conversion failed (resulting in NaN - "Not a Number"), return 0 instead of breaking the app
  return isNaN(num) ? 0 : num;
}
