/**
 * Converts a time duration string into milliseconds.
 *
 * This function takes a time duration string (e.g., "15m", "2h", "7d", "30s") and converts it into
 * milliseconds. The string format should include a numeric value followed by a single character
 * indicating the time unit:
 * - "s" for seconds
 * - "m" for minutes
 * - "h" for hours
 * - "d" for days
 *
 * @param {string} expiration - The time duration string to convert.
 * @returns {number} The equivalent duration in milliseconds.
 * 
 * @throws {Error} Throws an error if the time unit is not supported.
 * 
 * @example
 * // Convert 30 seconds to milliseconds
 * const ms = convertToMilliseconds("30s");
 * console.log(ms); // Outputs: 30000
 * 
 * @example
 * // Convert 15 minutes to milliseconds
 * const ms = convertToMilliseconds("15m");
 * console.log(ms); // Outputs: 900000
 * 
 * @example
 * // Convert 2 hours to milliseconds
 * const ms = convertToMilliseconds("2h");
 * console.log(ms); // Outputs: 7200000
 * 
 * @example
 * // Convert 7 days to milliseconds
 * const ms = convertToMilliseconds("7d");
 * console.log(ms); // Outputs: 604800000
 */
export function convertToMilliseconds(expiration: string): number {
  const timeValue = Number.parseInt(expiration.slice(0, -1)); // Extracts the numeric part

  if (Number.isNaN(timeValue)) {
    throw new Error(`Invalid numeric value in expiration: ${expiration}`);
  }

  const timeUnit = expiration.slice(-1); // Extracts the unit part (last character)
  
  switch (timeUnit) {
    case 's': return timeValue * 1000;                // Converts seconds to milliseconds
    case 'm': return timeValue * 60 * 1000;           // Converts minutes to milliseconds
    case 'h': return timeValue * 60 * 60 * 1000;      // Converts hours to milliseconds
    case 'd': return timeValue * 24 * 60 * 60 * 1000; // Converts days to milliseconds
    default: throw new Error(`Unsupported time unit in expiration: ${expiration}`);
  }
}