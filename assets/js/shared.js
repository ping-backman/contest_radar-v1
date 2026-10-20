// Trusted Types policy to satisfy strict CSP without breaking innerHTML assignments
let trustedTypesPolicy;
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  trustedTypesPolicy = window.trustedTypes.createPolicy('default', {
    createHTML: (string) => string,
    createScriptURL: (string) => string
  });
}

export function safeHTML(string) {
  return trustedTypesPolicy ? trustedTypesPolicy.createHTML(string) : string;
}

export function initBackToTop() {
  const button = document.querySelector('[data-back-to-top]');
  if (!button) return;
  const update = () => {
    const visible = window.scrollY > 400;
    button.classList.toggle('visible', visible);
    button.setAttribute('aria-hidden', String(!visible));
    button.tabIndex = visible ? 0 : -1;
  };
  window.addEventListener('scroll', update, {passive: true});
  update();
  button.addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

export function formatMoney(value, currency = 'USD') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value ? escapeHtml(value) : 'Not stated';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${currency || ''} ${amount.toLocaleString()}`.trim();
  }
}

export function formatDate(value, timezone = 'UTC') {
  if (!value) return 'Not stated';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const d = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: dateOnly ? 'UTC' : (timezone || 'UTC')
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(d);
  }
}

export function initImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback]').forEach(img => img.addEventListener('error', () => {
    const fallback = img.dataset.fallback;
    if (fallback && img.src !== fallback) img.src = fallback;
    else {
      img.removeAttribute('src');
      img.classList.add('image-failed');
    }
  }, {once: false}));
}

export function renderCard(item, index = 0) {
  const title = escapeHtml(item.title || 'Untitled competition');
  const slug = encodeURIComponent(item.slug || item.id || '');
  const rawImg = item.imageUrl || item.imageUrl2 || '/assets/images/contest-placeholder.svg';
  const img = escapeHtml(rawImg);
  const fallback = escapeHtml(item.imageUrl2 || '/assets/images/contest-placeholder.svg');
  
  const isAboveFold = index < 8;
  const loading = isAboveFold ? 'eager' : 'lazy';
  const fetchpriority = isAboveFold ? 'fetchpriority="high"' : '';
  
  let srcsetAttr = '';
  let sizesAttr = '';
  if (rawImg.includes('picsum.photos')) {
    const base = rawImg.replace(/\/\d+\/\d+$/, '');
    srcsetAttr = `srcset="${escapeHtml(base)}/400/300 400w, ${escapeHtml(base)}/800/600 800w"`;
    sizesAttr = `sizes="(max-width: 520px) 100vw, (max-width: 780px) 50vw, (max-width: 1050px) 33vw, 25vw"`;
  }

  const countryLabel = s => String(s || 'See official rules').split(/[;,\|]/).map(x => ({
    'GB': 'UK',
    'INT': 'International'
  }[x.trim().toUpperCase()] || x.trim().toUpperCase())).filter(Boolean).join(' · ');
  
  const countries = escapeHtml(countryLabel(item.eligibleCountries));

  return `<article class="contest-card">
    <a class="contest-card__image-link" href="/competition.html?id=${slug}" target="_blank" rel="noopener noreferrer">
      <img class="contest-card__image" src="${img}" ${srcsetAttr} ${sizesAttr} data-fallback="${fallback}" alt="${title}" loading="${loading}" decoding="async" ${fetchpriority}>
    </a>
    <div class="contest-card__body">
      <h2 class="contest-card__title"><a href="/competition.html?id=${slug}" target="_blank" rel="noopener noreferrer">${title}</a></h2>
      <p class="contest-card__fact">Prize: <span>${formatMoney(item.prizeValue, item.prizeCurrency)} value</span></p>
      <p class="contest-card__fact">Eligibility: <span>${countries}</span></p>
      <p class="contest-card__fact">Closing: <span>${formatDate(item.closingDate, item.timezone)}</span></p>
      <a class="button button--primary contest-card__button" href="/competition.html?id=${slug}" target="_blank" rel="noopener noreferrer">View competition →</a>
    </div>
  </article>`;
}

export function renderPagination({page, totalPages, queryString = ''}) {
  if (totalPages <= 1) return '';
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter(n => n >= 1 && n <= totalPages));
  const ordered = [...pages].sort((a, b) => a - b);
  let html = '';
  let last = 0;
  const link = (n, label = n, active = false, disabled = false) =>
    `<a class="page-link ${active ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}" ${disabled ? 'aria-disabled="true"' : ''} href="${disabled ? '#' : `/?page=${n}${queryString ? `&${queryString}` : ''}`}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
  
  html += link(Math.max(1, page - 1), '← Prev', false, page === 1);
  for (const n of ordered) {
    if (n - last > 1) html += '<span class="page-ellipsis">…</span>';
    html += link(n, n, n === page);
    last = n;
  }
  html += link(Math.min(totalPages, page + 1), 'Next →', false, page === totalPages);
  return html;
}
