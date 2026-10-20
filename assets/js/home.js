import { fetchCompetitions } from './api.js';
import { renderCard, renderPagination, initBackToTop, initImageFallbacks, escapeHtml } from './shared.js';
import { PAGE_SIZE } from './config.js';

const form = document.querySelector('#search-form');
const queryInput = document.querySelector('#search');
const countryInput = document.querySelector('#country');
const sortInput = document.querySelector('#sort');
const grid = document.querySelector('#contest-grid');
const status = document.querySelector('#results-status');
const pagination = document.querySelector('#pagination');

const params = new URLSearchParams(location.search);
queryInput.value = params.get('q') || '';
countryInput.value = params.get('country') || '';
sortInput.value = params.get('sort') || 'closing';
const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

form.addEventListener('submit', event => {
  event.preventDefault();
  const next = new URLSearchParams();
  if (queryInput.value.trim()) next.set('q', queryInput.value.trim());
  if (countryInput.value) next.set('country', countryInput.value);
  if (sortInput.value !== 'closing') next.set('sort', sortInput.value);
  const query = next.toString();
  location.href = query ? `/?${query}` : '/';
});

function queryForPage() {
  const query = new URLSearchParams();
  if (queryInput.value.trim()) query.set('q', queryInput.value.trim());
  if (countryInput.value) query.set('country', countryInput.value);
  if (sortInput.value !== 'closing') query.set('sort', sortInput.value);
  return query.toString();
}

function renderSkeletons() {
  return Array.from({ length: 8 }, () => `
    <article class="skeleton-card" aria-hidden="true">
      <div class="skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-line title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line button"></div>
      </div>
    </article>
  `).join('');
}

async function load() {
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = renderSkeletons();
  status.textContent = '';
  pagination.innerHTML = '';

  try {
    const data = await fetchCompetitions({
      q: queryInput.value.trim(),
      country: countryInput.value,
      sort: sortInput.value,
      page,
      limit: PAGE_SIZE
    });

    if (!Array.isArray(data.competitions)) {
      throw new Error('The API returned an invalid competitions list.');
    }

    if (!data.competitions.length) {
      grid.innerHTML = '<div class="state-message"><h2>No competitions found</h2><p>Try another search or country.</p></div>';
      status.textContent = '0 competitions';
      return;
    }

    grid.innerHTML = data.competitions.map((competition, index) => renderCard(competition, index)).join('');
    const pageSize = Number(data.pageSize) || PAGE_SIZE;
    const total = Number(data.total) || data.competitions.length;
    const currentPage = Number(data.page) || page;

    status.textContent = `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total} competitions`;
    pagination.innerHTML = renderPagination({
      page: currentPage,
      totalPages: Number(data.totalPages) || 1,
      queryString: queryForPage()
    });
    initImageFallbacks(grid);
  } catch (error) {
    grid.innerHTML = `
      <div class="state-message state-message--error">
        <h2>We couldn't load competitions</h2>
        <p>${escapeHtml(error instanceof Error ? error.message : 'An unexpected error occurred.')}</p>
        <button type="button" class="button button--secondary" id="retry">Try again</button>
      </div>
    `;
    document.querySelector('#retry')?.addEventListener('click', load);
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

initBackToTop();
load();
