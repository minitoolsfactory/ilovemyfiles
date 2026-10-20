/**
 * Country detection and India-only feature policy.
 *
 * TRUST MODEL
 * -----------
 * The country is resolved on the server from the hosting provider's own
 * geo data. On Cloudflare that is `request.cf.country` (populated by the edge)
 * and, as a fallback, the `CF-IPCountry` request header that the Cloudflare
 * edge writes. Both are server-side values: a client cannot set them because
 * Cloudflare replaces any client supplied `CF-*` header with its own.
 *
 * The browser never sends a country, and the browser language or time zone is
 * never used as evidence of location. If detection fails the feature fails
 * closed, so an unknown location never silently unlocks the tool.
 *
 * The country check only decides *whether the feature is offered*. It is not
 * an authorisation check and grants no access to any private record.
 */

/** ISO 3166-1 alpha-2 code for India. */
export const INDIA_COUNTRY_CODE = 'IN';

/** Codes Cloudflare uses when it cannot determine a country. */
const UNKNOWN_CODES = new Set(['XX', 'T1', 'ZZ']);

/** Access regions used by the UI. */
export const REGION = {
  INDIA: 'india',
  OUTSIDE: 'outside',
  UNKNOWN: 'unknown',
  CRAWLER: 'crawler'
};

/** The feature key that is gated by the country policy. */
export const FEATURE_KEY = 'cbse-result-analyzer';

/**
 * Normalise a country code.
 *
 * @param {unknown} value
 * @returns {string|null} an ISO alpha-2 code, or null when it is unknown
 */
export function normaliseCountry(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (UNKNOWN_CODES.has(code)) return null;
  return code;
}

/**
 * Resolve the visitor country from the hosting runtime.
 *
 * `CBSE_COUNTRY_OVERRIDE` is an operator control: it is a server side
 * environment variable, so it can only be set by whoever runs the deployment.
 * It is used to test the policy and to open the feature to a wider audience.
 *
 * @param {Object} options
 * @param {Request} [options.request]
 * @param {Object} [options.runtime] the Cloudflare runtime locals
 * @returns {{ code: string|null, source: string }}
 */
export function resolveCountry(options = {}) {
  const { request, runtime } = options;

  const override = readEnv(runtime, 'CBSE_COUNTRY_OVERRIDE');
  const overrideCountry = normaliseCountry(override ?? '');
  if (overrideCountry) return { code: overrideCountry, source: 'environment-override' };

  const runtimeCountry = normaliseCountry(runtime?.cf?.country ?? '');
  if (runtimeCountry) return { code: runtimeCountry, source: 'cloudflare-runtime' };

  const headerCountry = normaliseCountry(request?.headers?.get?.('cf-ipcountry') ?? '');
  if (headerCountry) return { code: headerCountry, source: 'cloudflare-header' };

  return { code: null, source: 'unavailable' };
}

/**
 * Read an environment value from the runtime bindings, falling back to
 * `process.env` during local development.
 *
 * @param {Object|undefined} runtime
 * @param {string} key
 * @returns {string|undefined}
 */
function readEnv(runtime, key) {
  const fromRuntime = runtime?.env?.[key];
  if (typeof fromRuntime === 'string' && fromRuntime.trim()) return fromRuntime.trim();
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string' && process.env[key].trim()) {
    return process.env[key].trim();
  }
  return undefined;
}

/**
 * Is the request a verified search crawler?
 *
 * Cloudflare sets `botManagement.verifiedBot` only after it has confirmed the
 * bot owns the domain, so the flag cannot be forged with a user agent header.
 *
 * @param {Object} [runtime]
 * @param {Request} [request]
 * @returns {boolean}
 */
export function isVerifiedCrawler(runtime, request) {
  const flag = runtime?.cf?.botManagement?.verifiedBot;
  if (flag === true) return true;
  if (flag === false) return false;
  // Outside Cloudflare (local development) fall back to a user agent check so
  // that the landing page can still be previewed as a crawler would see it.
  const agent = request?.headers?.get?.('user-agent') ?? '';
  return /bot|crawler|spider|bingpreview|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|slurp/i.test(agent);
}

/**
 * Apply the country policy.
 *
 * The message is identical for every visitor outside India, including search
 * crawlers, so the page never looks like it is serving different content to a
 * crawler than to a person. The crawler is still detected, but only so the
 * decision is explicit and observable in the response headers.
 *
 * @param {Object} input
 * @param {string|null} input.country
 * @param {boolean} [input.crawler]
 * @returns {{ region: string, country: string|null, showTool: boolean, showEntryPoint: boolean, indexable: boolean, reason: string, message: string }}
 */
export function resolveAccess(input = {}) {
  const country = normaliseCountry(input.country ?? '');
  const crawler = Boolean(input.crawler);

  const outside = {
    country,
    showTool: false,
    showEntryPoint: false,
    indexable: true,
    message: 'The interactive CBSE Result Analyzer is offered to visitors in India. The guide below explains what it produces, the gazette formats it reads and how every figure is calculated.'
  };

  if (country === INDIA_COUNTRY_CODE) {
    return {
      region: REGION.INDIA,
      ...outside,
      country,
      showTool: true,
      showEntryPoint: true,
      reason: 'india',
      message: ''
    };
  }

  if (crawler) {
    return { region: REGION.CRAWLER, ...outside, reason: 'crawler' };
  }

  if (!country) {
    return { region: REGION.UNKNOWN, ...outside, reason: 'country-unavailable' };
  }

  return { region: REGION.OUTSIDE, ...outside, reason: 'outside-india' };
}

/**
 * The complete policy for a request, ready to be serialised.
 *
 * @param {Object} options
 * @param {Request} [options.request]
 * @param {Object} [options.runtime]
 * @returns {Object}
 */
export function buildGeoPolicy(options = {}) {
  const { request, runtime } = options;
  const country = resolveCountry({ request, runtime });
  const crawler = isVerifiedCrawler(runtime, request);
  const access = resolveAccess({ country: country.code, crawler });
  return {
    feature: FEATURE_KEY,
    country: access.country,
    countrySource: country.source,
    region: access.region,
    reason: access.reason,
    showTool: access.showTool,
    showEntryPoint: access.showEntryPoint,
    indexable: access.indexable,
    message: access.message,
    detectedAt: new Date().toISOString()
  };
}
