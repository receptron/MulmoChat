// Request values that become part of a file name under output/. Anything that
// could add a path separator or `..` is refused rather than cleaned.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

export const isSafeFileName = (value: unknown): value is string =>
  typeof value === "string" && SAFE_NAME_PATTERN.test(value);

export const isStringRecord = (
  value: unknown,
): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === "string");
