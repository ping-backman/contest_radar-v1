import { API_BASE, PAGE_SIZE } from './config.js';

export async function fetchCompetitions(params = {}) {
  const url = new URL(API_BASE);
  const values = { limit: PAGE_SIZE, ...params };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {headers: {Accept: 'application/json'}});
  let payload;
  try { payload = await response.json(); } catch { throw new Error('The API returned an unreadable response.'); }
  if (!response.ok || payload.ok !== true) throw new Error(payload.error || 'Unable to load competitions. Please try again.');
  return payload;
}
