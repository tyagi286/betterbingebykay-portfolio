/**
 * Better Binge by Kay — app.js
 * Builds the whole page from SITE_CONFIG (js/config.js), fetching each
 * Drive folder's photo list via the public Drive API v3 (client-side,
 * since GitHub Pages has no server to run DriveApp on your behalf).
 */

// ── Utility ───────────────────────────────────────────────────────────
function instagramProfileUrl(cfg) {
  return cfg.instagramHandle ? 'https://instagram.com/' + cfg.instagramHandle.replace(/^@/, '') : '';
}

// Loads the Meta (Facebook/Instagram) Pixel only if a real ID is configured,
// so sites that leave metaPixelId blank don't pay for an unused script fetch.
function initMetaPixel(cfg) {
  var pixelId = (cfg.metaPixelId || '').trim();
  if (!pixelId) return;

  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = true; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', pixelId);
  fbq('track', 'PageView');
}

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
function renderGalleryShell(title, note, priceNote, groupId, testimonial, anchorId) {
  const priceHtml = priceNote ? `<div class="gallery-note-row"><span class="gallery-price-badge">${escapeHtml(priceNote)}</span></div>` : '';
  const testimonialHtml = testimonial ? `<p class="testimonial">${escapeHtml(testimonial)}</p>` : '';
  const idAttr = anchorId ? ` id="${escapeHtml(anchorId)}"` : '';

  return `
  <div class="gallery-section section-block reveal-target"${idAttr} data-group-label="${groupId}" data-name="${escapeHtml(title)}" data-price="">
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

// ── Add-Ons (static chip list — roses, cards, bouquets, etc) ────────────
function renderAddOnsSection(cfg) {
  const addOns = cfg.addOns;
  if (!addOns || !addOns.items || addOns.items.length === 0) return '';

  const chipsHtml = addOns.items.map(function (item) {
    return '<span class="city-chip">' + escapeHtml(item) + '</span>';
  }).join('\n');

  return `
  <div class="section-block reveal-target" data-group-label="addons" data-name="Add-Ons" data-price="">
    <div class="section-head">
      <h2>${escapeHtml(addOns.title)}</h2>
      <div class="section-divider"><span>✦</span></div>
      <p>${escapeHtml(addOns.note)}</p>
    </div>
    <div class="delivery-cities">${chipsHtml}</div>
  </div>`;
}

// ── Our Promise / payment policy strip ───────────────────────────────────
function renderPolicySection(cfg) {
  const policy = cfg.paymentPolicy;
  if (!policy || !policy.points || policy.points.length === 0) return '';

  const pointsHtml = policy.points.map(function (p) {
    return '<div class="policy-point"><span class="policy-icon">' + escapeHtml(p.icon || '') + '</span><span>' + escapeHtml(p.text) + '</span></div>';
  }).join('\n');

  return `
  <div class="policy-strip reveal-target" data-group-label="policy" data-name="Policy" data-price="">
    <div class="policy-title">${escapeHtml(policy.title)}</div>
    <div class="policy-points">${pointsHtml}</div>
  </div>`;
}

// ── Customer reviews (loaded from reviews.json, independent of Drive) ───

// Global store: reviewImagesData[i] = [{thumb, full}] for review i
var reviewImagesData = [];

function starString(rating) {
  const r = Math.max(0, Math.min(5, Math.round(rating || 5)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

// Build the Google Drive image URL variants for a single file ID
function driveThumbUrl(fileId, size) {
  return 'https://lh3.googleusercontent.com/d/' + fileId.trim() + '=w' + size;
}

// Open the lightbox for a specific review's image set (bypasses DOM querying
// so it works even when cards are duplicated inside the marquee track).
function openReviewLb(reviewIdx, photoIdx) {
  var images = reviewImagesData[reviewIdx];
  if (!images || images.length === 0) return;

  lb.photos   = images.map(function (img) { return img.full; });
  lb.groupId  = 'review-' + reviewIdx;
  lb.photoIdx = photoIdx;
  lb.name     = '📸 Customer Photos';
  lb.price    = '';

  _renderLb();
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function reviewCardHtml(review, index) {
  const initials = (review.name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();

  // Product pill — lives inside the footer meta block now
  const productTag = review.productOrdered
    ? '<div class="review-product">' + escapeHtml(review.productOrdered) + '</div>'
    : '';

  // ── Photo strip (only when the review carries Drive image IDs) ──────────
  var imagesHtml = '';
  if (review.images && review.images.length > 0) {
    var thumbItems = review.images.map(function (fileId, imgIdx) {
      var thumb = driveThumbUrl(fileId, 400);
      return '<div class="review-img-thumb" ' +
               'onclick="openReviewLb(' + index + ',' + imgIdx + ')" ' +
               'title="Tap to view full size">' +
               '<img src="' + escapeHtml(thumb) + '" ' +
                    'alt="' + escapeHtml((review.name || '') + ' photo ' + (imgIdx + 1)) + '" ' +
                    'loading="lazy" ' +
                    'onerror="this.closest(\'.review-img-thumb\').style.display=\'none\'">' +
               '<div class="review-img-overlay"><span>🔍</span></div>' +
               '<div class="review-img-zoom-badge">🔍</div>' +
             '</div>';
    }).join('');
    imagesHtml =
      '<div class="review-img-label"><span>📷</span> ' +
        review.images.length + ' Photo' + (review.images.length > 1 ? 's' : '') +
      '</div>' +
      '<div class="review-images-strip">' + thumbItems + '</div>' +
      '<div class="review-img-tap-hint">👆 Tap photos to view full size</div>';
  }

  return (
    '<div class="review-card' + (review.images && review.images.length > 0 ? ' has-photos' : '') + '">' +
      // Large background quote glyph — purely decorative
      '<div class="review-deco-quote">\u201C</div>' +
      // Body copy
      '<p class="review-text">' + escapeHtml(review.text || '') + '</p>' +
      // Footer: avatar + name + stars + product
      '<div class="review-card-footer">' +
        '<div class="review-avatar">' + escapeHtml(initials) + '</div>' +
        '<div class="review-meta">' +
          '<div class="review-name">' + escapeHtml(review.name || 'Happy Customer') + '</div>' +
          '<div class="review-stars">' + starString(review.rating) + '</div>' +
          productTag +
        '</div>' +
      '</div>' +
      imagesHtml +
    '</div>'
  );
}

async function loadReviews() {
  const slot = document.getElementById('reviewsSlot');
  if (!slot) return;
  try {
    const res = await fetch('reviews.json', { cache: 'no-store' });
    if (!res.ok) return;
    const reviews = await res.json();
    if (!Array.isArray(reviews) || reviews.length === 0) return;

    // Pre-compute image URL data so openReviewLb() never has to touch the DOM.
    // This makes it safe to call from duplicated marquee cards too.
    reviewImagesData = reviews.map(function (review) {
      if (!review.images || review.images.length === 0) return [];
      return review.images.map(function (fileId) {
        return { thumb: driveThumbUrl(fileId, 400), full: driveThumbUrl(fileId, 1600) };
      });
    });

    // ── Dual-track infinite scroll ────────────────────────────────────────
    // Row 1 scrolls left  (original order). Row 2 scrolls right (reversed
    // order) at a slightly slower pace — the speed difference creates a
    // satisfying sense of depth. Both rows pause together on hover / touch.
    //
    // With few reviews, one pass through the list isn't wide enough to
    // fill a normal screen — that leaves a visible gap of empty track
    // scrolling past before the looped copy catches up (the "goes blank"
    // bug). Fix: repeat the review set enough times to build one "lap"
    // that's comfortably wider than any realistic screen, THEN duplicate
    // that whole lap once for the seamless loop. Scales down naturally as
    // more reviews get added.
    const MIN_CARDS_PER_LAP = 14;
    const repeatFactor = Math.max(1, Math.ceil(MIN_CARDS_PER_LAP / reviews.length));

    function buildLap(list, indexMap) {
      var out = [];
      for (var t = 0; t < repeatFactor; t++) {
        list.forEach(function (item, i) { out.push(reviewCardHtml(item, indexMap(i))); });
      }
      return out.join('');
    }

    const revList = reviews.slice().reverse();
    const lap1 = buildLap(reviews, function (i) { return i; });
    const lap2 = buildLap(revList, function (i) { return reviews.length - 1 - i; });

    // The scrolling rows repeat each review several times over (to fill the
    // lap width, then again for the seamless loop) — great visually, but a
    // screen reader would otherwise read the same review 3-4x. The marquee
    // itself is marked aria-hidden, and this plain list carries the real
    // content instead (one entry per review, no duplicates).
    const srListHtml =
      '<ul class="sr-only">' +
        reviews.map(function (r) {
          return '<li>' + escapeHtml(r.name || 'Happy Customer') + ', ' +
            Math.max(0, Math.min(5, Math.round(r.rating || 5))) + ' out of 5 stars: ' +
            escapeHtml(r.text || '') + '</li>';
        }).join('') +
      '</ul>';

    const bodyHtml =
      srListHtml +
      '<div class="reviews-dual-wrap" id="reviewsDualWrap" aria-hidden="true">' +
        '<div class="reviews-track-row"         id="rvTrack1">' + lap1 + lap1 + '</div>' +
        '<div class="reviews-track-row reverse" id="rvTrack2">' + lap2 + lap2 + '</div>' +
      '</div>';

    slot.innerHTML =
      '<div class="section-block reveal-target" data-group-label="reviews" data-name="Reviews" data-price="">' +
        '<div class="reviews-section-bg">' +
          '<div class="section-head">' +
            '<div class="reviews-eyebrow">\u2756 customer love \u2756</div>' +
            '<h2>What They\'re Saying</h2>' +
            '<div class="section-divider"><span>\u2756</span></div>' +
            '<p>Every kind word keeps us baking with love.</p>' +
          '</div>' +
          bodyHtml +
        '</div>' +
      '</div>';

    // Set each track's duration from its measured pixel width and a target speed
    function setTrackSpeed(trackEl, pxPerSec) {
      trackEl.style.animationPlayState = 'paused';
      requestAnimationFrame(function () {
        var single = trackEl.scrollWidth / 2; // track holds 2 copies
        var dur    = Math.max(12, single / pxPerSec);
        trackEl.style.animationDuration    = dur.toFixed(1) + 's';
        trackEl.style.animationPlayState   = 'running';
      });
    }

    var track1 = document.getElementById('rvTrack1');
    var track2 = document.getElementById('rvTrack2');
    setTrackSpeed(track1, 30); // px / s — left row
    setTrackSpeed(track2, 22); // px / s — right row (slightly slower = depth)

    // Pause both simultaneously on hover or touch
    var wrap   = document.getElementById('reviewsDualWrap');
    var pause  = function () { track1.style.animationPlayState = 'paused';  track2.style.animationPlayState = 'paused';  };
    var resume = function () { track1.style.animationPlayState = 'running'; track2.style.animationPlayState = 'running'; };
    wrap.addEventListener('mouseenter', pause);
    wrap.addEventListener('mouseleave', resume);
    wrap.addEventListener('touchstart', pause,  { passive: true });
    wrap.addEventListener('touchend',   resume, { passive: true });

    // Scroll-reveal for the section wrapper
    var el = slot.querySelector('.reveal-target');
    if (el) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
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
    // reviews.json missing, malformed, or fetch blocked — fail silently.
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

// ── Promo Spotlight — loaded from promo.json ────────────────────────────
// Deterministic particle positions [left%, duration-s, delay-s]
var PROMO_PARTICLES = [
  [8,  10.2, 2.1], [20, 8.5,  5.3], [35, 12.0, 1.0], [48, 9.3,  3.7],
  [62, 11.5, 0.5], [74, 7.8,  4.2], [88, 13.1, 6.9], [15, 9.0,  7.5],
  [42, 10.8, 2.8], [58, 8.2,  5.0], [78, 11.7, 0.2], [92, 9.6,  3.3]
];

async function loadPromo() {
  var slot = document.getElementById('promoSlot');
  if (!slot) return;

  var promo;
  try {
    var res = await fetch('promo.json', { cache: 'no-store' });
    if (!res.ok) return;
    promo = await res.json();
  } catch (e) { return; }

  if (!promo || !promo.active) return;

  // Hide automatically if the offer has expired
  if (promo.validUntil) {
    var expiry = new Date(promo.validUntil);
    expiry.setHours(23, 59, 59, 999);
    if (Date.now() > expiry.getTime()) return;
  }

  var cfg     = SITE_CONFIG;
  var waRaw   = (cfg.orderCta && cfg.orderCta.whatsappNumber || '').trim();
  var wa      = /^\d{10,15}$/.test(waRaw) ? waRaw : '';
  var ctaMsg  = (promo.cta && promo.cta.whatsappMessage) || '';
  var ctaHref = wa
    ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(ctaMsg)
    : (instagramProfileUrl(cfg) || '#');
  var ctaIcon = (promo.cta && promo.cta.icon) || '🎀';

  var disc        = promo.discount;
  var hasDiscount = disc && disc.active;
  var promoId     = promo.id || 'offer';
  var photoGroupId = 'promo-' + promoId;
  var cdId        = 'promoCD-' + promoId;

  // ── Price block ─────────────────────────────────────────────────────────
  var priceHtml;
  if (hasDiscount) {
    var ordersLeft  = typeof disc.ordersLeft === 'number' ? disc.ordersLeft : (disc.totalSlots || 10);
    var totalSlots  = disc.totalSlots || 10;
    var taken       = totalSlots - ordersLeft;
    var barPct      = Math.min(100, Math.round((taken / totalSlots) * 100));
    var urgencyText = (disc.urgencyText || '🔥 Only {n} spots left!').replace('{n}', ordersLeft);
    priceHtml =
      '<div class="promo-price-block">' +
        '<div class="promo-price-row">' +
          '<span class="promo-price-original">' + escapeHtml(promo.price) + '</span>' +
          '<span class="promo-price-now">'      + escapeHtml(disc.discountedPrice) + '</span>' +
          '<span class="promo-discount-pill">\u2011' + escapeHtml(String(disc.percent)) + '% OFF</span>' +
        '</div>' +
        '<div class="promo-discount-label">' + escapeHtml(disc.label || '') + '</div>' +
        (ordersLeft > 0
          ? '<div class="promo-urgency">' +
              '<div class="promo-urgency-text">' + escapeHtml(urgencyText) + '</div>' +
              '<div class="promo-urgency-bar-wrap">' +
                '<div class="promo-urgency-bar">' +
                  '<div class="promo-urgency-fill" style="width:' + barPct + '%"></div>' +
                '</div>' +
                '<span class="promo-urgency-slots">' + taken + '/' + totalSlots + ' claimed</span>' +
              '</div>' +
            '</div>'
          : '') +
      '</div>';
  } else {
    priceHtml = '<div class="promo-price-block"><div class="promo-price-only">' + escapeHtml(promo.price) + '</div></div>';
  }

  // ── What's inside ────────────────────────────────────────────────────────
  var includesHtml = '';
  if (promo.includes && promo.includes.length > 0) {
    var chips = promo.includes.map(function (item) {
      return '<span class="promo-include-chip">' +
               '<span class="promo-include-icon">' + escapeHtml(item.icon || '') + '</span>' +
               escapeHtml(item.text || '') +
             '</span>';
    }).join('');
    includesHtml =
      '<div class="promo-includes">' +
        '<div class="promo-includes-label">What\'s Inside</div>' +
        '<div class="promo-includes-chips">' + chips + '</div>' +
      '</div>';
  }

  // ── Countdown ────────────────────────────────────────────────────────────
  var countdownHtml = '';
  if (promo.showCountdown && promo.validUntil) {
    countdownHtml =
      '<div class="promo-countdown" id="' + cdId + '">' +
        '<div class="promo-cd-label">\u23f3 Offer ends in</div>' +
        '<div class="promo-cd-timer">' +
          '<div class="promo-cd-block"><span class="promo-cd-num" id="' + cdId + '-d">00</span><span class="promo-cd-unit">days</span></div>' +
          '<span class="promo-cd-sep">:</span>' +
          '<div class="promo-cd-block"><span class="promo-cd-num" id="' + cdId + '-h">00</span><span class="promo-cd-unit">hrs</span></div>' +
          '<span class="promo-cd-sep">:</span>' +
          '<div class="promo-cd-block"><span class="promo-cd-num" id="' + cdId + '-m">00</span><span class="promo-cd-unit">min</span></div>' +
          '<span class="promo-cd-sep">:</span>' +
          '<div class="promo-cd-block"><span class="promo-cd-num" id="' + cdId + '-s">00</span><span class="promo-cd-unit">sec</span></div>' +
        '</div>' +
      '</div>';
  }

  // ── Floating particles ────────────────────────────────────────────────────
  var particleEmojis = ['\u2728', '\uD83C\uDF80', '\uD83C\uDF38', '\uD83D\uDC9B', '\uD83C\uDF1F', '\uD83E\uDDE1'];
  var particlesHtml = PROMO_PARTICLES.map(function (pos, i) {
    return '<span class="promo-particle" style="left:' + pos[0] + '%;animation-duration:' + pos[1] + 's;animation-delay:-' + pos[2] + 's;">' +
             particleEmojis[i % particleEmojis.length] +
           '</span>';
  }).join('');

  // ── Assemble full HTML ────────────────────────────────────────────────────
  var displayPrice = hasDiscount ? escapeHtml(disc.discountedPrice) : escapeHtml(promo.price);

  slot.innerHTML =
    '<div class="promo-spotlight reveal-target" id="promoSpotlight"' +
        ' data-group-label="' + photoGroupId + '"' +
        ' data-name="'  + escapeHtml(promo.title) + '"' +
        ' data-price="' + displayPrice + '">' +

      '<div class="promo-bg-shimmer" aria-hidden="true"></div>' +
      '<div class="promo-particles-wrap" aria-hidden="true">' + particlesHtml + '</div>' +

      '<div class="promo-top-badge">' + escapeHtml(promo.badge || 'Special Offer') + '</div>' +

      '<div class="promo-inner">' +
        /* ── header: eyebrow / title / desc — always visible at top on mobile ── */
        '<div class="promo-info-header">' +
          '<div class="promo-eyebrow">' + escapeHtml(promo.eyebrow || '') + '</div>' +
          '<h2 class="promo-title">'   + escapeHtml(promo.title) + '</h2>' +
          (promo.subtitle    ? '<p class="promo-subtitle">' + escapeHtml(promo.subtitle)    + '</p>' : '') +
          (promo.description ? '<p class="promo-desc">'     + escapeHtml(promo.description) + '</p>' : '') +
        '</div>' +

        /* ── photos: right column on desktop, between header & body on mobile ── */
        '<div class="promo-media" id="promo-photos-' + escapeHtml(promoId) + '">' +
          skeletonGridHtml(3) +
        '</div>' +

        /* ── body: price / includes / countdown / CTA — below photos on mobile ── */
        '<div class="promo-info-body">' +
          priceHtml +
          includesHtml +
          countdownHtml +
          '<a href="' + ctaHref + '" class="promo-cta-btn" target="_blank" rel="noopener"' +
             ' aria-label="' + escapeHtml((promo.cta && promo.cta.text) || 'Order Now') + '">' +
            '<span class="promo-cta-icon" aria-hidden="true">' + escapeHtml(ctaIcon) + '</span>' +
            '<span>' + escapeHtml((promo.cta && promo.cta.text) || 'Order Now') + '</span>' +
          '</a>' +
        '</div>' +
      '</div>' +

    '</div>';

  // Start countdown ticker
  if (promo.showCountdown && promo.validUntil) {
    startPromoCountdown(promo.validUntil, cdId);
  }

  // Load photos from Drive (skip if folder ID is a placeholder)
  var fid = (promo.folderId || '').trim();
  if (fid && fid.indexOf('PASTE_') !== 0) {
    var urls    = await getThumbUrls(fid);
    var photoEl = document.getElementById('promo-photos-' + promoId);
    if (photoEl) photoEl.innerHTML = photoGridHtml(urls, photoGroupId, promo.title);
    wireUpNewPhotos(photoGroupId);
  }

  // Scroll-reveal
  var revealEl = slot.querySelector('.reveal-target');
  if (revealEl) {
    if ('IntersectionObserver' in window) {
      var promoIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('visible'); promoIO.unobserve(en.target); }
        });
      }, { threshold: 0.05 });
      promoIO.observe(revealEl);
    } else {
      revealEl.classList.add('visible');
    }
  }
}

// Live countdown for the promo offer
function startPromoCountdown(validUntil, cdId) {
  var expiry = new Date(validUntil);
  expiry.setHours(23, 59, 59, 999);

  function pad2(n) { return String(Math.max(0, n)).padStart(2, '0'); }

  function tick() {
    var diff = expiry.getTime() - Date.now();
    if (diff <= 0) {
      var el = document.getElementById(cdId);
      if (el) el.innerHTML = '<div class="promo-cd-expired">This offer has ended.</div>';
      return;
    }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000)  / 60000);
    var s = Math.floor((diff % 60000)    / 1000);
    var dEl = document.getElementById(cdId + '-d');
    var hEl = document.getElementById(cdId + '-h');
    var mEl = document.getElementById(cdId + '-m');
    var sEl = document.getElementById(cdId + '-s');
    if (dEl) dEl.textContent = pad2(d);
    if (hEl) hEl.textContent = pad2(h);
    if (mEl) mEl.textContent = pad2(m);
    if (sEl) sEl.textContent = pad2(s);
  }

  tick();
  setInterval(tick, 1000);
}

// ── Hamper teaser (shown near Packaging, links down to the full Hampers
// section which now sits later on the page) ──────────────────────────────
function renderHamperTeaserShell(cfg) {
  const teaser = cfg.hamperTeaser;
  if (!teaser || !teaser.enabled) return '';

  return `
  <a href="#hamper-section" class="hamper-teaser reveal-target" id="hamperTeaserCard">
    <div class="hamper-teaser-photo" id="hamperTeaserPhoto"><div class="skeleton-item"></div></div>
    <div class="hamper-teaser-text">
      <div class="hamper-teaser-msg">${escapeHtml(teaser.text)}</div>
      <div class="hamper-teaser-link">${escapeHtml(teaser.linkText || 'See Hampers')} ↓</div>
    </div>
  </a>`;
}

async function fillHamperTeaserPhoto(cfg) {
  const teaser = cfg.hamperTeaser;
  if (!teaser || !teaser.enabled) return;
  const el = document.getElementById('hamperTeaserPhoto');
  if (!el) return;

  const urls = await getThumbUrls(cfg.hamper.folderId);
  if (!urls || urls.length === 0) { el.remove(); return; } // no photo yet — teaser still works as a text link

  const first = urls[0];
  el.innerHTML = '<img src="' + first.thumbA + '" alt="Hamper preview" loading="lazy" ' +
    'onerror="this.onerror=null;this.src=\'' + first.thumbB + '\';">';
}

// ── Build the whole page ─────────────────────────────────────────────────
async function buildPage() {
  const cfg = SITE_CONFIG;

  document.title = cfg.displayName;

  initMetaPixel(cfg);

  // Logo — just an <img src>, no base64 needed outside Apps Script
  // (handcrafted seal badge intentionally removed per latest design pass)
  const logoWrap = document.getElementById('logoWrap');
  if (cfg.logoFileId && cfg.logoFileId.trim() !== '') {
    logoWrap.innerHTML = '<div class="logo-ring"></div>' +
      '<img class="logo" src="https://lh3.googleusercontent.com/d/' + cfg.logoFileId.trim() + '=w300" ' +
      'alt="' + escapeHtml(cfg.displayName) + ' logo" ' +
      'onerror="this.closest(\'.logo-wrap\').style.display=\'none\'">';
  } else {
    logoWrap.style.display = 'none';
  }

  document.getElementById('heroTitle').innerHTML = escapeHtml(cfg.displayName).replace(/\bby\b/, '<em>by</em>');
  document.getElementById('tagline').textContent = cfg.tagline;

  const handleBadge = document.getElementById('handleBadge');
  if (cfg.instagramHandle) {
    handleBadge.textContent = cfg.instagramHandle;
    handleBadge.href = instagramProfileUrl(cfg);
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
  } else if (instagramProfileUrl(cfg)) {
    cta.href = instagramProfileUrl(cfg);
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

  document.getElementById('hamperTeaserSlot').innerHTML = renderHamperTeaserShell(cfg);

  document.getElementById('tierSlot').innerHTML =
    cfg.tiers.map(function (tier, i) { return renderTierShell(tier, i); }).join('\n');

  document.getElementById('hamperSlot').innerHTML =
    renderGalleryShell(cfg.hamper.title, cfg.hamper.note, cfg.hamper.priceNote, 'hamper', null, 'hamper-section');

  document.getElementById('addOnsSlot').innerHTML = renderAddOnsSection(cfg);

  document.getElementById('policySlot').innerHTML = renderPolicySection(cfg);

  initPageBehaviors();

  // Fire off each folder's fetch independently
  loadPromo();
  fillGalleryPhotos(cfg.packaging.folderId, 'packaging', cfg.packaging.title);
  cfg.tiers.forEach(function (tier, i) { fillTierPhotos(tier, i); });
  fillGalleryPhotos(cfg.hamper.folderId, 'hamper', cfg.hamper.title);
  fillHamperTeaserPhoto(cfg);
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