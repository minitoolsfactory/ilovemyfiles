import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INDIA_COUNTRY_CODE,
  REGION,
  normaliseCountry,
  resolveCountry,
  isVerifiedCrawler,
  resolveAccess,
  buildGeoPolicy
} from '../src/lib/geo.js';

function requestWith(headers = {}) {
  return new Request('https://ilovemyfiles.com/', { headers });
}

test('a country code is normalised', () => {
  assert.equal(normaliseCountry('in'), 'IN');
  assert.equal(normaliseCountry(' us '), 'US');
  assert.equal(normaliseCountry('XX'), null, 'XX means the country is unknown');
  assert.equal(normaliseCountry('T1'), null, 'T1 means the visitor is on Tor');
  assert.equal(normaliseCountry(''), null);
  assert.equal(normaliseCountry('IND'), null);
  assert.equal(normaliseCountry(undefined), null);
});

test('the country comes from the hosting runtime first', () => {
  const result = resolveCountry({
    request: requestWith({ 'cf-ipcountry': 'US' }),
    runtime: { cf: { country: 'IN' } }
  });
  assert.equal(result.code, 'IN');
  assert.equal(result.source, 'cloudflare-runtime');
});

test('the country falls back to the edge header', () => {
  const result = resolveCountry({ request: requestWith({ 'cf-ipcountry': 'IN' }) });
  assert.equal(result.code, 'IN');
  assert.equal(result.source, 'cloudflare-header');
});

test('a header that is not the country header is ignored', () => {
  const result = resolveCountry({
    request: requestWith({ 'x-country': 'IN', 'x-vercel-ip-country': 'IN', 'cf-ipcountry': 'US' })
  });
  assert.equal(result.code, 'US');
});

test('an unknown country fails closed', () => {
  const result = resolveCountry({ request: requestWith() });
  assert.equal(result.code, null);
  assert.equal(result.source, 'unavailable');
});

test('a visitor in India gets the tool and the entry point', () => {
  const access = resolveAccess({ country: 'IN' });
  assert.equal(access.region, REGION.INDIA);
  assert.equal(access.showTool, true);
  assert.equal(access.showEntryPoint, true);
  assert.equal(access.indexable, true);
  assert.equal(access.message, '');
});

test('a visitor outside India gets the landing page but not the tool', () => {
  const access = resolveAccess({ country: 'DE' });
  assert.equal(access.region, REGION.OUTSIDE);
  assert.equal(access.showTool, false);
  assert.equal(access.showEntryPoint, false);
  assert.equal(access.indexable, true);
  assert.ok(access.message.length > 0);
});

test('an unknown country does not unlock the tool', () => {
  const access = resolveAccess({ country: null });
  assert.equal(access.region, REGION.UNKNOWN);
  assert.equal(access.showTool, false);
  assert.equal(access.showEntryPoint, false);
});

test('a search crawler reaches the landing page and the tool stays closed', () => {
  const access = resolveAccess({ country: 'US', crawler: true });
  assert.equal(access.region, REGION.CRAWLER);
  assert.equal(access.showTool, false);
  assert.equal(access.showEntryPoint, false);
  assert.equal(access.indexable, true);
});

test('a crawler and a visitor outside India are given the same message', () => {
  const crawler = resolveAccess({ country: 'US', crawler: true });
  const visitor = resolveAccess({ country: 'US' });
  assert.equal(crawler.message, visitor.message);
});

test('the Cloudflare verified bot flag is used when it is present', () => {
  assert.equal(isVerifiedCrawler({ cf: { botManagement: { verifiedBot: true } } }, requestWith()), true);
  assert.equal(isVerifiedCrawler({ cf: { botManagement: { verifiedBot: false } } }, requestWith({ 'user-agent': 'Googlebot' })), false);
});

test('the complete policy is built from a request', () => {
  const policy = buildGeoPolicy({
    request: requestWith({ 'cf-ipcountry': 'IN' }),
    runtime: { cf: { country: 'IN' } }
  });
  assert.equal(policy.feature, 'cbse-result-analyzer');
  assert.equal(policy.country, 'IN');
  assert.equal(policy.region, 'india');
  assert.equal(policy.showTool, true);
  assert.equal(policy.indexable, true);
  assert.ok(policy.detectedAt);
});

test('the India code is the ISO code for India', () => {
  assert.equal(INDIA_COUNTRY_CODE, 'IN');
});
