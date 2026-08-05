/**
 * Better Binge by Kay — app.js
 * Builds the whole page from SITE_CONFIG (js/config.js), fetching each
 * Drive folder's photo list via the public Drive API v3 (client-side,
 * since GitHub Pages has no server to run DriveApp on your behalf).
 */

// ── Utility ───────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ── Fetch a folder's image files from the Drive API ─────────────────────
// Mirrors the old getThumbUrls(): builds the same 3-candidate hotlink
// chain per image, just sourced from a fetch() call instead of DriveApp.
async function getThumbUrls(folderId) {
  if (!folderId || folderId.trim() === '' || folderId.indexOf('PASTE_') === 0) {
    return [];
  }
  const key = SITE_CONFIG.driveApiKey;
  if (!key || key.indexOf('PASTE_') === 0) {
    return null; // signals a missing-API-key error to the caller
  }

  const q = encodeURIComponent(
    `'${folderId.trim()}' in parents and trashed = false and ` +
    `(mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp')`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=200&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null; // bad key, folder not public, quota, etc.
    const data = await res.json();
    const files = data.files || [];
    return files.map(function (file) {
      const id = file.id;
      return {
        id: id,
        thumbA: 'https://lh3.googleusercontent.com/d/' + id + '=w500',
        thumbB: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w500',
        thumbC: 'https://drive.google.com/uc?export=view&id=' + id,
        fullA: 'https://lh3.googleusercontent.com/d/' + id + '=w1600',
        fullB: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600',
        viewUrl: 'https://drive.google.com/file/d/' + id + '/view'
      };
    });
  } catch (e) {
    return null;
  }
}

function skeletonGridHtml(count) {
  var items = [];
  for (var i = 0; i < (count || 4); i++) items.push('<div class="skeleton-item"></div>');
  return '<div class="grid">' + items.join('\n') + '</div>';
}

function photoGridHtml(urls, groupId, altLabel) {
  if (urls === null) {
    return '<p class="empty-msg section-error">⚠️ Could not load photos — check DRIVE_API_KEY in js/config.js and make sure the folder is shared as "Anyone with the link".</p>';
  }
  if (urls.length === 0) {
    return '<p class="empty-msg">Photos coming soon 🌸</p>';
  }
  const tags = urls.map(function (u, i) {
    return '<div class="photo-item" data-group="' + groupId + '" onclick="openLb(\'' + groupId + '\',' + i + ')">' +
             '<img src="' + u.thumbA + '" ' +
                  'data-fallback-b="' + u.thumbB + '" ' +
                  'data-fallback-c="' + u.thumbC + '" ' +
                  'data-view-url="' + u.viewUrl + '" ' +
                  'data-full="' + u.fullA + '" data-full-b="' + u.fullB + '" ' +
                  'alt="' + escapeHtml(altLabel) + ' sample" loading="lazy" ' +
                  'onerror="handleImgError(this)">' +
             '<span class="tap-label">👆 Tap to view full size</span>' +
           '</div>';
  });
  return '<div class="grid">' + tags.join('\n') + '</div>';
}

// ── Render a priced brownie-box tier ─────────────────────────────────────
// Two-phase: the shell (header, price, skeleton grid) renders instantly;
// fillTierPhotos() swaps the skeleton for real photos once Drive responds.
function renderTierShell(tier, tierIdx) {
  const tierNum = String(tierIdx + 1).padStart(2, '0');
  const groupId = 'tier' + tierIdx;
  const ribbonHtml = tier.featured ? '<div class="ribbon">Most Loved</div>' : '';

  return `
  <div class="tier-card reveal-target${tier.featured ? ' featured' : ''}" data-group-label="${groupId}" data-name="${escapeHtml(tier.label)}" data-price="${escapeHtml(tier.price)}">
    ${ribbonHtml}
    <div class="tier-header">
      <span class="tier-num">${tierNum}</span>
      <div class="tier-title-block">
        <div class="tier-name">${tier.emoji}&nbsp; ${escapeHtml(tier.label)}</div>
        <div class="tier-note">${escapeHtml(tier.note)}</div>
        <div class="tier-facts">
          <span class="tier-fact">${escapeHtml(tier.pieces)}</span>
          <span class="tier-fact">${escapeHtml(tier.weight)}</span>
        </div>
      </div>
      <div class="tier-price-badge">${escapeHtml(tier.price)}</div>
    </div>
    <div class="photos-wrap" id="photos-${groupId}">
      ${skeletonGridHtml(4)}
    </div>
  </div>`;
}

async function fillTierPhotos(tier, tierIdx) {
  const groupId = 'tier' + tierIdx;
  const urls = await getThumbUrls(tier.folderId);
  const el = document.getElementById('photos-' + groupId);
  if (el) el.innerHTML = photoGridHtml(urls, groupId, tier.label);
  wireUpNewPhotos(groupId);
}

// ── Render an un-priced-per-item gallery section (packaging / hampers) ──
function renderGalleryShell(title, note, priceNote, groupId, testimonial) {
  const priceHtml = priceNote ? `<div class="gallery-note-row"><span class="gallery-price-badge">${escapeHtml(priceNote)}</span></div>` : '';
  const testimonialHtml = testimonial ? `<p class="testimonial">${escapeHtml(testimonial)}</p>` : '';

  return `
  <div class="gallery-section section-block reveal-target" data-group-label="${groupId}" data-name="${escapeHtml(title)}" data-price="">
    <div class="section-head">
      <h2>${escapeHtml(title)}</h2>
      <div class="section-divider"><span>✦</span></div>
      <p>${escapeHtml(note)}</p>
    </div>
    ${priceHtml}
    <div id="photos-${groupId}">
      ${skeletonGridHtml(4)}
    </div>
    ${testimonialHtml}
  </div>`;
}

async function fillGalleryPhotos(folderId, groupId, title) {
  const urls = await getThumbUrls(folderId);
  const el = document.getElementById('photos-' + groupId);
  if (el) el.innerHTML = photoGridHtml(urls, groupId, title);
  wireUpNewPhotos(groupId);
}

// ── Customer reviews (loaded from reviews.json, independent of Drive) ───
function starString(rating) {
  const r = Math.max(0, Math.min(5, Math.round(rating || 5)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function reviewCardHtml(review) {
  const initials = (review.name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  const productTag = review.productOrdered ? '<span class="review-product">Ordered: ' + escapeHtml(review.productOrdered) + '</span>' : '';
  return '<div class="review-card">' +
      '<div class="review-top">' +
        '<div class="review-avatar">' + escapeHtml(initials) + '</div>' +
        '<div class="review-meta">' +
          '<div class="review-name">' + escapeHtml(review.name || 'Happy Customer') + '</div>' +
          '<div class="review-stars">' + starString(review.rating) + '</div>' +
        '</div>' +
      '</div>' +
      '<p class="review-text">&ldquo;' + escapeHtml(review.text || '') + '&rdquo;</p>' +
      productTag +
    '</div>';
}

async function loadReviews() {
  const slot = document.getElementById('reviewsSlot');
  if (!slot) return;
  try {
    const res = await fetch('reviews.json', { cache: 'no-store' });
    if (!res.ok) return; // no file yet — section just stays empty/hidden
    const reviews = await res.json();
    if (!Array.isArray(reviews) || reviews.length === 0) return;

    // 3 or fewer: plain static grid. More than 3: auto-scrolling marquee
    // (list duplicated once so the loop is seamless), paused on hover/touch
    // so people can actually read a card before it slides away.
    const useMarquee = reviews.length > 3;
    const cardsHtml = useMarquee
      ? [].concat(reviews, reviews).map(reviewCardHtml).join('\n')
      : reviews.map(reviewCardHtml).join('\n');

    const bodyHtml = useMarquee
      ? `<div class="reviews-marquee-wrap" id="reviewsMarquee">
           <div class="reviews-marquee-track">${cardsHtml}</div>
         </div>`
      : `<div class="reviews-grid">${cardsHtml}</div>`;

    slot.innerHTML = `
      <div class="section-block reveal-target" data-group-label="reviews" data-name="Reviews" data-price="">
        <div class="section-head">
          <h2>Loved by Our Customers</h2>
          <div class="section-divider"><span>✦</span></div>
          <p>Real words from real orders.</p>
        </div>
        ${bodyHtml}
      </div>`;

    if (useMarquee) {
      const wrap = document.getElementById('reviewsMarquee');
      const track = wrap.querySelector('.reviews-marquee-track');

      // Constant-speed crawl (not "N seconds per card") is what makes this
      // read as a calm, editorial scroll rather than a ticker — same
      // technique used on testimonial walls like Clerk's or Linear's.
      const PX_PER_SECOND = 34; // slow, readable pace — lower = slower
      track.style.animationPlayState = 'paused';
      requestAnimationFrame(function () {
        const singleSetWidth = track.scrollWidth / 2; // track holds 2 copies
        const duration = Math.max(20, singleSetWidth / PX_PER_SECOND);
        track.style.animationDuration = duration.toFixed(1) + 's';
        track.style.animationPlayState = 'running';
      });

      const pause = function () { track.style.animationPlayState = 'paused'; };
      const resume = function () { track.style.animationPlayState = 'running'; };
      wrap.addEventListener('mouseenter', pause);
      wrap.addEventListener('mouseleave', resume);
      wrap.addEventListener('touchstart', pause, { passive: true });
      wrap.addEventListener('touchend', resume, { passive: true });
    }

    const el = slot.querySelector('.reveal-target');
    if (el) {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
          });
        }, { threshold: 0.10 });
        io.observe(el);
      } else {
        el.classList.add('visible');
      }
    }
  } catch (e) {
    // reviews.json missing, malformed, or fetch blocked (e.g. opening the
    // file directly instead of via a real server) — fail silently.
  }
}

// ── Where We Deliver (static, config-driven, no Drive fetch needed) ─────
function renderDeliverySection(cfg) {
  const info = cfg.serviceInfo;
  if (!info) return '';

  const trustHtml = info.happyCustomers
    ? `<p class="delivery-trust">🎉 Loved by ${escapeHtml(info.happyCustomers)} happy customers</p>` : '';

  const citiesHtml = (info.cities || []).map(function (c) {
    return '<span class="city-chip">📍 ' + escapeHtml(c) + '</span>';
  }).join('\n');

  const pickupHtml = info.pickup ? `
    <div class="delivery-method">
      <span class="dm-icon">🏠</span>
      <div>
        <div class="dm-title">${escapeHtml(info.pickup.title)}</div>
        <div class="dm-text">${escapeHtml(info.pickup.text)}</div>
      </div>
    </div>` : '';

  const deliveryHtml = info.delivery ? `
    <div class="delivery-method">
      <span class="dm-icon">🛵</span>
      <div>
        <div class="dm-title">${escapeHtml(info.delivery.title)}</div>
        <div class="dm-text">${escapeHtml(info.delivery.text)}</div>
      </div>
    </div>` : '';

  return `
  <div class="section-block reveal-target" data-group-label="delivery" data-name="Delivery" data-price="">
    <div class="section-head">
      <h2>Where We Deliver</h2>
      <div class="section-divider"><span>✦</span></div>
      <p>Proudly serving the Tricity area — pickup and delivery both available.</p>
    </div>
    ${trustHtml}
    <div class="delivery-cities">${citiesHtml}</div>
    <div class="delivery-methods">${pickupHtml}${deliveryHtml}</div>
  </div>`;
}

// ── Build the whole page ─────────────────────────────────────────────────
async function buildPage() {
  const cfg = SITE_CONFIG;

  document.title = cfg.displayName;

  // Logo + handcrafted seal badge — just an <img src>, no base64 needed
  // outside Apps Script
  const logoWrap = document.getElementById('logoWrap');
  if (cfg.logoFileId && cfg.logoFileId.trim() !== '') {
    logoWrap.innerHTML = '<div class="logo-ring"></div>' +
      '<img class="logo" src="https://lh3.googleusercontent.com/d/' + cfg.logoFileId.trim() + '=w300" ' +
      'alt="' + escapeHtml(cfg.displayName) + ' logo" ' +
      'onerror="this.closest(\'.logo-wrap\').style.display=\'none\'">' 
      // +'<div class="handcrafted-seal"><span>100%<br>Handcrafted</span></div>'
      ;
  } else {
    logoWrap.style.display = 'none';
  }

  document.getElementById('heroTitle').innerHTML = escapeHtml(cfg.displayName).replace(/\bby\b/, '<em>by</em>');
  document.getElementById('tagline').textContent = cfg.tagline;

  const handleBadge = document.getElementById('handleBadge');
  if (cfg.instagramHandle) {
    handleBadge.textContent = cfg.instagramHandle;
  } else {
    handleBadge.style.display = 'none';
  }

  const kayNoteEl = document.getElementById('kayNote');
  if (cfg.kayNote) {
    kayNoteEl.textContent = cfg.kayNote;
  } else {
    kayNoteEl.style.display = 'none';
  }

  document.getElementById('footerBrand').textContent = cfg.displayName;

  // Floating CTA: WhatsApp if a real number is configured, otherwise fall
  // back to Instagram. The pill text is always visible now (not just on
  // hover) since hover tooltips don't work on phones, which is most of
  // this site's traffic.
  const cta = document.getElementById('floatingCta');
  const ctaLabel = document.getElementById('floatingCtaLabel');
  const waRaw = (cfg.orderCta && cfg.orderCta.whatsappNumber || '').trim();
  const wa = /^\d{10,15}$/.test(waRaw) ? waRaw : ''; // ignore unfilled placeholder like '91XXXXXXXXXX'
  if (wa) {
    cta.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(cfg.orderCta.orderMessage || '');
    cta.setAttribute('aria-label', 'Order on WhatsApp');
    ctaLabel.textContent = 'Click to Order';
  } else if (cfg.instagramHandle) {
    cta.href = 'https://instagram.com/' + cfg.instagramHandle.replace(/^@/, '');
    cta.setAttribute('aria-label', 'Order on Instagram');
    ctaLabel.textContent = 'DM to Order';
  } else {
    cta.style.display = 'none';
  }

  // Section shells render instantly (with skeleton placeholders); each
  // section's photos then swap in as soon as its own Drive request lands,
  // instead of the whole page waiting on the slowest folder.
  document.getElementById('deliverySlot').innerHTML = renderDeliverySection(cfg);

  document.getElementById('packagingSlot').innerHTML =
    renderGalleryShell(cfg.packaging.title, cfg.packaging.note, null, 'packaging', cfg.packaging.testimonial);

  document.getElementById('tierSlot').innerHTML =
    cfg.tiers.map(function (tier, i) { return renderTierShell(tier, i); }).join('\n');

  document.getElementById('hamperSlot').innerHTML =
    renderGalleryShell(cfg.hamper.title, cfg.hamper.note, cfg.hamper.priceNote, 'hamper', null);

  initPageBehaviors();

  // Fire off each folder's fetch independently
  fillGalleryPhotos(cfg.packaging.folderId, 'packaging', cfg.packaging.title);
  cfg.tiers.forEach(function (tier, i) { fillTierPhotos(tier, i); });
  fillGalleryPhotos(cfg.hamper.folderId, 'hamper', cfg.hamper.title);
  loadReviews();
}

// ── Lightbox state ────────────────────────────────────────────────────
var lb = { groupId: '', photoIdx: 0, photos: [], name: '', price: '' };

function openLb(groupId, photoIdx) {
  var imgs = document.querySelectorAll('.photo-item[data-group="' + groupId + '"] img');
  lb.photos   = [].map.call(imgs, function (i) { return getWorkingFull(i); });
  lb.groupId  = groupId;
  lb.photoIdx = photoIdx;

  var head = document.querySelector('[data-group-label="' + groupId + '"]');
  lb.name  = head ? head.getAttribute('data-name')  : '';
  lb.price = head ? head.getAttribute('data-price') : '';

  _renderLb();
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function _renderLb() {
  var imgEl    = document.getElementById('lb-img');
  var loaderEl = document.getElementById('lb-loader');

  imgEl.classList.remove('lb-img-visible');
  loaderEl.style.display = 'block';

  imgEl.onload = function () {
    loaderEl.style.display = 'none';
    imgEl.classList.add('lb-img-visible');
  };
  imgEl.onerror = function () {
    loaderEl.style.display = 'none';
  };
  imgEl.src = lb.photos[lb.photoIdx];

  document.getElementById('lb-cat').textContent = (lb.name + '  ' + lb.price).trim();
  document.getElementById('lb-cnt').textContent = (lb.photoIdx + 1) + ' / ' + lb.photos.length;

  document.getElementById('lb-prev').className = 'lb-arrow' + (lb.photos.length < 2 ? ' hidden' : '');
  document.getElementById('lb-next').className = 'lb-arrow' + (lb.photos.length < 2 ? ' hidden' : '');

  var dotsEl = document.getElementById('lb-dots');
  dotsEl.innerHTML = '';
  if (lb.photos.length > 1) {
    lb.photos.forEach(function (_, i) {
      var d = document.createElement('div');
      d.className = 'lb-dot' + (i === lb.photoIdx ? ' active' : '');
      d.onclick = function () { lb.photoIdx = i; _renderLb(); };
      dotsEl.appendChild(d);
    });
  }
}

function lbNav(dir) {
  lb.photoIdx = (lb.photoIdx + dir + lb.photos.length) % lb.photos.length;
  _renderLb();
}

function closeLb() {
  document.getElementById('lb').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Image fallback chain ────────────────────────────────
function handleImgError(img) {
  var stage = img.dataset.stage || '0';
  if (stage === '0' && img.dataset.fallbackB) {
    img.dataset.stage = '1';
    img.src = img.dataset.fallbackB;
    return;
  }
  if (stage === '1' && img.dataset.fallbackC) {
    img.dataset.stage = '2';
    img.src = img.dataset.fallbackC;
    return;
  }
  var wrap = img.closest('.photo-item');
  if (wrap && img.dataset.viewUrl) {
    wrap.innerHTML = '<a href="' + img.dataset.viewUrl + '" target="_blank" rel="noopener" class="view-fallback">🖼️<br>Tap to view photo</a>';
  }
}

function getWorkingFull(imgEl) {
  return imgEl.src.indexOf('lh3.googleusercontent') !== -1
    ? (imgEl.dataset.full || imgEl.src)
    : (imgEl.dataset.fullB || imgEl.dataset.full || imgEl.src);
}

// ── Wire up everything that needs the DOM built (lightbox, toast, etc) ──
function initPageBehaviors() {
  document.getElementById('lb-prev').onclick  = function (e) { e.stopPropagation(); lbNav(-1); };
  document.getElementById('lb-next').onclick  = function (e) { e.stopPropagation(); lbNav(+1); };
  document.getElementById('lb-close').onclick = function (e) { e.stopPropagation(); closeLb(); };
  document.getElementById('lb').onclick = function (e) { if (e.target === this) closeLb(); };

  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('lb').classList.contains('open')) return;
    if (e.key === 'ArrowLeft')  lbNav(-1);
    if (e.key === 'ArrowRight') lbNav(+1);
    if (e.key === 'Escape')     closeLb();
  });

  var _tx = null;
  document.getElementById('lb').addEventListener('touchstart', function (e) { _tx = e.changedTouches[0].clientX; }, { passive: true });
  document.getElementById('lb').addEventListener('touchend', function (e) {
    if (_tx === null) return;
    var dx = e.changedTouches[0].clientX - _tx;
    if (Math.abs(dx) > 45) lbNav(dx < 0 ? 1 : -1);
    _tx = null;
  }, { passive: true });

  (function () {
    var t = document.getElementById('tapToast');
    setTimeout(function () { t.classList.add('show'); }, 1200);
    setTimeout(function () { t.classList.remove('show'); }, 5000);
  })();

  (function () {
    var cards = document.querySelectorAll('.reveal-target');
    if (!('IntersectionObserver' in window)) { cards.forEach(function (c) { c.classList.add('visible'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.10 });
    cards.forEach(function (c) { io.observe(c); });
  })();
}

// Fades a group's <img> thumbnails in once each one finishes loading.
// Called after a section's skeleton grid is swapped for real photos.
function wireUpNewPhotos(groupId) {
  document.querySelectorAll('.photo-item[data-group="' + groupId + '"] img').forEach(function (img) {
    img.classList.add('loading');
    if (img.complete) { img.classList.add('loaded'); return; }
    img.addEventListener('load', function () { img.classList.remove('loading'); img.classList.add('loaded'); });
  });
}

document.addEventListener('DOMContentLoaded', buildPage);