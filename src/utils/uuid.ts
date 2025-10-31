/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID() in secure contexts (HTTPS/localhost),
 * falls back to a simple random UUID generator otherwise.
 */
export function generateUUID(): string {
  // Use native crypto.randomUUID if available (HTTPS or localhost)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for non-secure contexts (HTTP)
  // Simple UUID v4 implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
