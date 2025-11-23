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
        formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
      formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
