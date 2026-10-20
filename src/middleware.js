/**
 * Astro middleware.
 *
 * Resolves the visitor country once per request from the hosting provider's
 * trusted geo data and stores it on `context.locals.geo`. The country is
 * never taken from the browser.
 *
 * Prerendered pages are static files, so no request metadata is available for
 * them and none is read: the policy is resolved for server rendered routes
 * only, and it fails closed when it cannot be resolved.
 */

import { defineMiddleware } from 'astro:middleware';
import { buildGeoPolicy } from './lib/geo.js';

const CLOSED_POLICY = Object.freeze({
  feature: 'cbse-result-analyzer',
  country: null,
  countrySource: 'unavailable',
  region: 'unknown',
  reason: 'country-unavailable',
  showTool: false,
  showEntryPoint: false,
  indexable: true,
  message: 'We could not determine your country, so the interactive analyzer is not loaded. The interactive CBSE Result Analyzer is available to visitors in India.',
  detectedAt: ''
});

export const onRequest = defineMiddleware(async (context, next) => {
  let policy = CLOSED_POLICY;

  if (!context.isPrerendered) {
    try {
      policy = buildGeoPolicy({ request: context.request, runtime: context.locals.runtime });
    } catch {
      policy = CLOSED_POLICY;
    }
  }

  context.locals.geo = policy;

  const response = await next();

  // The rendered page and the policy endpoint differ per country, so caches
  // must not serve one country's response to another.
  response.headers.set('Vary', 'CF-IPCountry, Accept-Encoding');
  response.headers.set('X-CBSE-Region', policy.region);

  if (context.url.pathname.startsWith('/tools/cbse-result-analyzer')) {
    response.headers.set('Cache-Control', 'private, no-cache, must-revalidate');
    response.headers.set('X-Robots-Tag', policy.indexable ? 'index, follow' : 'noindex, follow');
  }

  return response;
});
