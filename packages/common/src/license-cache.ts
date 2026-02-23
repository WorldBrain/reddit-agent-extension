import { validateLicense } from "./lemonsqueezy";
import type { LicenseValidationResult } from "./lemonsqueezy";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedValidation {
  result: LicenseValidationResult;
  timestamp: number;
}

let cache: CachedValidation | null = null;
let cachedKey: string | null = null;

export async function validateLicenseCached(
  licenseKey: string,
  instanceId?: string,
  forceRefresh = false
): Promise<LicenseValidationResult> {
  if (cachedKey !== licenseKey) {
    cache = null;
    cachedKey = null;
  }

  if (
    !forceRefresh &&
    cache &&
    Date.now() - cache.timestamp < CACHE_TTL_MS
  ) {
    return cache.result;
  }

  const result = await validateLicense(licenseKey, instanceId);
  cache = { result, timestamp: Date.now() };
  cachedKey = licenseKey;
  return result;
}

export function invalidateLicenseCache(): void {
  cache = null;
  cachedKey = null;
}
