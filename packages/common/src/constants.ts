// @ts-ignore
const isDev = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) || 
              (typeof process !== "undefined" && process.env.NODE_ENV === "development");

export const WEBSITE_URL = isDev
  ? "http://localhost:7259"
  : "https://redditagent.com";

export const LEMONSQUEEZY_API_BASE =
  "https://api.lemonsqueezy.com/v1/licenses";
export const LEMONSQUEEZY_VALIDATE_URL = `${LEMONSQUEEZY_API_BASE}/validate`;
export const LEMONSQUEEZY_ACTIVATE_URL = `${LEMONSQUEEZY_API_BASE}/activate`;
export const LEMONSQUEEZY_DEACTIVATE_URL = `${LEMONSQUEEZY_API_BASE}/deactivate`;

export const LEMONSQUEEZY_STORE_SLUG = "memexgarden";
export const LEMONSQUEEZY_PRODUCT_ID = "826296";
export const LEMONSQUEEZY_VARIANT_ID = "1302394";
export const LEMONSQUEEZY_CHECKOUT_URL = "https://memexgarden.lemonsqueezy.com/checkout/buy/6f186722-5198-4107-902f-a3ce48045d38";
