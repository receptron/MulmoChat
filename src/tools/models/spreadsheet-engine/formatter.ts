/**
 * Number Formatting Utilities
 *
 * Handles Excel-style format codes for currency, percentages, decimals, etc.
 */

/**
 * Format a number according to Excel format code
 *
 * Supported formats:
 * - Currency: $#,##0.00, $#,##0
 * - Percentage: 0.00%, 0.0%
 * - Integer with commas: #,##0
 * - Decimal: 0.00, 0.000
 *
 * @param value - The numeric value to format
 * @param format - The Excel format code
 * @returns Formatted string representation
 */
export function formatNumber(value: number, format: string): string {
  if (!format) return value.toString();

  try {
    // Handle currency formats
    if (format.includes("$")) {
      const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
      const hasComma = format.includes(",");

      let formatted = Math.abs(value).toFixed(decimals >= 0 ? decimals : 0);
      if (hasComma) {
        // Add thousand separators without regex to avoid performance issues
        const parts = formatted.split(".");
        const integerPart = parts[0];
        let result = "";
        for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
          if (count > 0 && count % 3 === 0) {
            result = "," + result;
          }
          result = integerPart[i] + result;
        }
        parts[0] = result;
        formatted = parts.join(".");
      }
      formatted = "$" + formatted;
      if (value < 0) formatted = "-" + formatted;
      return formatted;
    }

    // Handle percentage
    if (format.includes("%")) {
      const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
      return (value * 100).toFixed(decimals >= 0 ? decimals : 2) + "%";
    }

    // Handle comma separator
    if (format.includes(",")) {
      const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
      let formatted = Math.abs(value).toFixed(decimals >= 0 ? decimals : 0);
      // Add thousand separators without regex to avoid performance issues
      const parts = formatted.split(".");
      const integerPart = parts[0];
      let result = "";
      for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
        if (count > 0 && count % 3 === 0) {
          result = "," + result;
        }
        result = integerPart[i] + result;
      }
      parts[0] = result;
      formatted = parts.join(".");
      if (value < 0) formatted = "-" + formatted;
      return formatted;
    }

    // Handle decimal places
    const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
    if (decimals >= 0) {
      return value.toFixed(decimals);
    }

    return value.toString();
  } catch (error) {
    console.error("Format error:", error);
    return value.toString();
  }
}
