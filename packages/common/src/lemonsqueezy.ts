import {
  LEMONSQUEEZY_VALIDATE_URL,
  LEMONSQUEEZY_ACTIVATE_URL,
  LEMONSQUEEZY_DEACTIVATE_URL,
} from "./constants";

export interface LicenseKeyInfo {
  id: number;
  status: string;
  key: string;
  activationLimit: number;
  activationUsage: number;
  expiresAt: string | null;
}

export interface LicenseMeta {
  storeId: number;
  orderId: number;
  productId: number;
  productName: string;
  variantId: number;
  variantName: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
  licenseKey?: LicenseKeyInfo;
  meta?: LicenseMeta;
}

export interface LicenseActivationResult {
  activated: boolean;
  error?: string;
  instanceId?: string;
  licenseKey?: LicenseKeyInfo;
}

export async function validateLicense(
  licenseKey: string,
  instanceId?: string
): Promise<LicenseValidationResult> {
  try {
    const body: Record<string, string> = { license_key: licenseKey };
    if (instanceId) body.instance_id = instanceId;

    const response = await fetch(LEMONSQUEEZY_VALIDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(body).toString(),
    });

    const data = await response.json();

    if (!response.ok || data.valid === false) {
      return {
        valid: false,
        error: data.error || data.message || "License validation failed",
      };
    }

    return {
      valid: true,
      licenseKey: data.license_key
        ? {
            id: data.license_key.id,
            status: data.license_key.status,
            key: data.license_key.key,
            activationLimit: data.license_key.activation_limit,
            activationUsage: data.license_key.activation_usage,
            expiresAt: data.license_key.expires_at,
          }
        : undefined,
      meta: data.meta
        ? {
            storeId: data.meta.store_id,
            orderId: data.meta.order_id,
            productId: data.meta.product_id,
            productName: data.meta.product_name,
            variantId: data.meta.variant_id,
            variantName: data.meta.variant_name,
            customerId: data.meta.customer_id,
            customerName: data.meta.customer_name,
            customerEmail: data.meta.customer_email,
          }
        : undefined,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error:
        err instanceof Error ? err.message : "Network error during validation",
    };
  }
}

export async function activateLicense(
  licenseKey: string,
  instanceName: string
): Promise<LicenseActivationResult> {
  try {
    const response = await fetch(LEMONSQUEEZY_ACTIVATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        license_key: licenseKey,
        instance_name: instanceName,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok || data.activated === false) {
      return {
        activated: false,
        error: data.error || data.message || "License activation failed",
      };
    }

    return {
      activated: true,
      instanceId: data.instance?.id,
      licenseKey: data.license_key
        ? {
            id: data.license_key.id,
            status: data.license_key.status,
            key: data.license_key.key,
            activationLimit: data.license_key.activation_limit,
            activationUsage: data.license_key.activation_usage,
            expiresAt: data.license_key.expires_at,
          }
        : undefined,
    };
  } catch (err: unknown) {
    return {
      activated: false,
      error:
        err instanceof Error
          ? err.message
          : "Network error during activation",
    };
  }
}

export async function deactivateLicense(
  licenseKey: string,
  instanceId: string
): Promise<{ deactivated: boolean; error?: string }> {
  try {
    const response = await fetch(LEMONSQUEEZY_DEACTIVATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        license_key: licenseKey,
        instance_id: instanceId,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok || data.deactivated === false) {
      return {
        deactivated: false,
        error: data.error || data.message || "License deactivation failed",
      };
    }

    return { deactivated: true };
  } catch (err: unknown) {
    return {
      deactivated: false,
      error:
        err instanceof Error
          ? err.message
          : "Network error during deactivation",
    };
  }
}
