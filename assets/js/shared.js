// Keep the Trusted Types compatibility hook used by the homepage.
let trustedTypesPolicy;
if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
  try {
    trustedTypesPolicy = window.trustedTypes.createPolicy('default', {
      createHTML: value => value,
      createScriptURL: value => value
    });
  } catch {
    // A policy may already be registered by another script.
  }
}

export function safeHTML(value) {
  return trustedTypesPolicy ? trustedTypesPolicy.createHTML(String(value)) : String(value);
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

  window.addEventListener('scroll', update, { passive: true });
  update();
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
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

  const dateOnly = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(value));
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: dateOnly ? 'UTC' : (timezone || 'UTC')
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }
}

export function initImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback]').forEach(image => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.fallback;
      // Compare the literal attribute: image.src is normally an absolute URL.
      if (fallback && image.getAttribute('src') !== fallback) {
        image.src = fallback;
      } else {
        image.removeAttribute('src');
        image.classList.add('image-failed');
      }
    });
  });
}

function normalizeImageURL(value, fallback) {
  const candidate = String(value || '').trim();
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate, window.location.origin);
    const isRelative = candidate.startsWith('/') || candidate.startsWith('./') || candidate.startsWith('../');
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    if (!isRelative && !/^https?:\\/\\//i.test(candidate)) return fallback;
    return isRelative ? candidate : url.href;
  } catch {
    return fallback;
  }
}

function imageAttributes(value) {
  const fallback = '/assets/images/contest-placeholder.svg';
  const safeURL = normalizeImageURL(value, fallback);
  let src = safeURL;
  let srcset = '';
  let sizes = '';

  try {
    const url = new URL(safeURL, window.location.origin);
    if (/(^|\\.)picsum\\.photos$/i.test(url.hostname)) {
      const dimensions = url.pathname.match(/\\/(\\d+)\\/(\\d+)$/);
      if (dimensions) {
        const basePath = url.pathname.slice(0, dimensions.index);
        const small = new URL(url.href);
        const large = new URL(url.href);
        small.pathname = `${basePath}/400/300`;
        large.pathname = `${basePath}/800/600`;
        src = small.href;
        srcset = ` srcset="${escapeHtml(small.href)} 400w, ${escapeHtml(large.href)} 800w"`;
        sizes = ' sizes="(max-width: 520px) 100vw, (max-width: 780px) 50vw, (max-width: 1050px) 33vw, 25vw"';
      }
    }
  } catch {
    src = fallback;
  }

  return { src: escapeHtml(src), srcset, sizes };
}

export function renderCard(item, index = 0) {
  const title = escapeHtml(item.title || 'Untitled competition');
  const slug = encodeURIComponent(item.slug || item.id || '');
  const fallback = normalizeImageURL(
    item.imageUrl2 || '/assets/images/contest-placeholder.svg',
    '/assets/images/contest-placeholder.svg'
  );
  const imageURL = normalizeImageURL(
    item.imageUrl || item.imageUrl2 || '/assets/images/contest-placeholder.svg',
    '/assets/images/contest-placeholder.svg'
  );
  const image = imageAttributes(imageURL);

  const countryLabel = value => String(value || 'See official rules').split(/[;,|]/).map(part => ({
    GB: 'UK',
    INT: 'International'
  }[part.trim().toUpperCase()] || part.trim().toUpperCase())).filter(Boolean).join(' · ');

  const countries = escapeHtml(countryLabel(item.eligibleCountries));
  const eager = index < 4;
  const priority = index === 0 ? ' fetchpriority="high"' : '';
  const loading = eager ? 'eager' : 'lazy';
  const ariaLabel = `View competition details for ${title}`;

  return `
    <article class="contest-card">
      <a class="contest-card__image-link" href="/competition.html?id=${slug}" target="_blank" rel="noopener noreferrer" aria-label="View ${title}">
        <img class="contest-card__image" src="${image.src}"${image.srcset}${image.sizes} data-fallback="${escapeHtml(fallback)}" alt="${title}" loading="${loading}" decoding="async"${priority}>
      </a>
      <div class="contest-card__body">
        <h2 class="contest-card__title">
          <a href="/competition.html?id=${slug}" target="_blank" rel="noopener noreferrer">${title}</a>
        </h2>
        <p class="contest-card__fact"><span>Prize:</span> ${formatMoney(item.prizeValue, item.prizeCurrency)} value</p>
        <p class="contest-card__fact"><span>Eligibility:</span> ${countries}</p>
        <p class="contest-card__fact"><span>Closing:</span> ${formatDate(item.closingDate, item.timezone)}</p>
        <a class="button button--primary contest-card__button" href="/competition.html?id=${slug}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}">
          View competition <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  `;
}

export function renderPagination({ page, totalPages, queryString = '' }) {
  if (totalPages <= 1) return '';

  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter(number =>
    number >= 1 && number <= totalPages
  ));
  const ordered = [...pages].sort((a, b) => a - b);
  let html = '';
  let last = 0;

  const link = (number, label = number, active = false, disabled = false) => {
    const classes = ['page-link', active ? 'is-active' : '', disabled ? 'is-disabled' : '']
      .filter(Boolean).join(' ');
    let href = '';

    if (!disabled) {
      const params = new URLSearchParams(queryString);
      params.set('page', String(number));
      href = ` href="/?${escapeHtml(params.toString())}"`;
    }

    return `<a class="${classes}"${href}${disabled ? ' aria-disabled="true" tabindex="-1"' : ''}${active ? ' aria-current="page"' : ''}>${label}</a>`;
  };

  html += link(Math.max(1, page - 1), '← Prev', false, page === 1);
  for (const number of ordered) {
    if (number - last > 1) html += '<span class="page-ellipsis">…</span>';
    html += link(number, number, number === page);
    last = number;
  }
  html += link(Math.min(totalPages, page + 1), 'Next →', false, page === totalPages);

  return `<nav class="pagination" aria-label="Competition pages">${html}</nav>`;
}
