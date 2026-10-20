/**
 * Country policy endpoint.
 *
 * The static pages of the site ask this endpoint whether the India-only
 * feature entry point should be revealed. The answer is computed on the
 * server from the hosting provider's trusted country value, so a visitor
 * cannot unlock the entry point by sending a header.
 */

import type { APIRoute } from 'astro';
import { buildGeoPolicy } from '../../lib/geo.js';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const runtime = locals.runtime;
  const policy = locals.geo?.feature
    ? locals.geo
    : buildGeoPolicy({ request, runtime });

  const body = JSON.stringify({
    feature: policy.feature,
    country: policy.country,
    countrySource: policy.countrySource,
    region: policy.region,
    reason: policy.reason,
    showEntryPoint: policy.showEntryPoint,
    showTool: policy.showTool,
    indexable: policy.indexable
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Vary': 'CF-IPCountry, Accept-Encoding'
    }
  });
};
