import { fetchCompetitions } from './api.js';
import { renderCard, renderPagination, initBackToTop, initImageFallbacks, escapeHtml, safeHTML } from './shared.js';
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

form.addEventListener('submit', e => {
  e.preventDefault();
  const next = new URLSearchParams();
  if (queryInput.value.trim()) next.set('q', queryInput.value.trim());
  if (countryInput.value) next.set('country', countryInput.value);
  if (sortInput.value !== 'closing') next.set('sort', sortInput.value);
  location.href = '/?' + next.toString();
});

function queryForPage(n) {
  const p = new URLSearchParams();
  if (queryInput.value.trim()) p.set('q', queryInput.value.trim());
  if (countryInput.value) p.set('country', countryInput.value);
  if (sortInput.value !== 'closing') p.set('sort', sortInput.value);
  return p.toString();
}

async function load() {
  // Render 8 skeleton cards matching the exact dimensions of the contest cards
  const skeletons = Array.from({length: 8}, () => `
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
  
  grid.innerHTML = safeHTML(skeletons);
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
    
    if (!data.competitions.length) {
      grid.innerHTML = safeHTML(`<div class="state-message"><h2>No competitions found</h2><p>Try another search or country.</p></div>`);
      status.textContent = '0 competitions';
      return;
    }
    
    grid.innerHTML = safeHTML(data.competitions.map((c, i) => renderCard(c, i)).join(''));
    status.textContent = `Showing ${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} competitions`;
    pagination.innerHTML = safeHTML(renderPagination({
      page: data.page,
      totalPages: data.totalPages,
      queryString: queryForPage(page)
    }));
    initImageFallbacks(grid);
  } catch (err) {
    grid.innerHTML = safeHTML(`
      <div class="state-message state-message--error">
        <h2>We couldn't load competitions</h2>
        <p>${escapeHtml(err.message)}</p>
        <button id="retry" class="button button--secondary">Try again</button>
      </div>
    `);
    document.querySelector('#retry')?.addEventListener('click', load);
  }
}

initBackToTop();
load();
