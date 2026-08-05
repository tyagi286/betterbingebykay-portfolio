/**
 * Better Binge by Kay — DM Portfolio (GitHub Pages edition)
 * ─────────────────────────────────────────────────────────────────────────
 * This is the ONLY file you should need to edit for day-to-day changes
 * (prices, notes, folder IDs, etc). See README.md for full setup steps.
 *
 * HOW PHOTOS WORK NOW:
 * Google Apps Script could read your Drive folders directly on its own
 * server. GitHub Pages is a static host — there is no server — so the
 * page instead asks Google's Drive API, from the visitor's own browser,
 * "what image files are in this folder?" using DRIVE_API_KEY below.
 * That means:
 *   1. Folders must still be shared as "Anyone with the link — Viewer".
 *   2. You need a Drive API key (free, one-time setup — see README.md
 *      step 2). Paste it into DRIVE_API_KEY below.
 * Everything else — adding/removing photos in a folder to update the
 * site — works exactly like before.
 */

const SITE_CONFIG = {

  // Paste your Google Drive API key here (README.md → step 2)
  driveApiKey: 'AIzaSyAt2uKgBxn7N0AYAEsFjiBRaUbOMeYFb8E',

  // Paste your logo's Drive file ID here, or leave '' for no logo
  logoFileId: '1Y21SFbOI-dYDAWjpSCwG2dLkExf7SiuU',

  // DISPLAY_NAME is what's shown in the big heading — needs real spaces
  // ("Better Binge by Kay", not "betterbingebykay").
  // instagramHandle is shown as a small @-badge under the tagline.
  displayName: 'Better Binge by Kay',
  instagramHandle: '@betterbingebykay',
  tagline: 'Handcrafted with love 🤍',

  // Small handwritten-style line under the tagline. Leave '' to hide it.
  kayNote: '— every box packed by hand, just for you',

  // Floating "order now" button (bottom-right on every page).
  // If whatsappNumber is filled in (country code, no + or spaces, e.g.
  // '919876543210'), the button opens WhatsApp with orderMessage
  // pre-filled. Otherwise it falls back to your Instagram profile.
  orderCta: {
    whatsappNumber: '91XXXXXXXXXX', // ← replace with your real number: country code + number, no + or spaces or leading 0 (e.g. '919876543210' for +91 98765 43210)
    orderMessage: "Hi! I'd like to place an order 🍫"
  },

  // Shown in a "Where We Deliver" section near the top of the page.
  serviceInfo: {
    happyCustomers: '100+', // shown as a trust line, e.g. "100+ happy customers"
    cities: ['Chandigarh', 'Mohali', 'Panchkula', 'Derabassi', 'Zirakpur'],
    pickup: {
      title: 'Self Pickup',
      text: 'Sector 44C, near St. Joseph School'
    },
    delivery: {
      title: 'Home Delivery',
      text: 'Available via Rapido / Uber — delivery fee is separate and paid directly to the rider'
    }
  },

  // Shown once near the top — packaging applies to every order, regardless
  // of which tier or hamper someone picks.
  packaging: {
    title: 'The Unboxing',
    note: 'Every order is finished with the same care — here\'s what arrives at your door.',
    testimonial: '"Perfect balance of taste, freshness, and presentation." — customer review',
    folderId: '1qjgI2AyfAN-T2Xsf9yvJdg7gxqfIMRHM'
  },

  tiers: [
    {
      label: 'The Mini',
      price: '₹249',
      emoji: '🍫',
      pieces: '4 pieces',
      weight: '~220g',
      note: 'Classic flavours, no topper',
      folderId: '1nPWuglUqnhN3zTDXNiSuy4FNlUvubmN1'
    },
    {
      label: 'The Classic',
      price: '₹499',
      emoji: '🍰',
      pieces: '9 pieces',
      weight: '~500g',
      note: 'Classic flavours, no topper',
      folderId: '1AkUOwts6ixUFXlH4euiauFS3AjXityx1'
    },
    {
      label: 'The Signature',
      price: '₹599',
      emoji: '✨',
      pieces: '9 pieces',
      weight: '~500g',
      note: 'Plain waffer topper included',
      folderId: '1wYJ65OOsnuK3RKQ-_HhJAyKJPUPV0pBr'
    },
    {
      label: 'The Personalised',
      price: '₹749',
      emoji: '🎨',
      pieces: '9 pieces',
      weight: '~500g',
      note: 'Your photo, doodle, or name printed on the waffer',
      folderId: '1zioCF-8bnaghDsIjvYdNDYjn41E3PepP',
      featured: true // shows the "Most Loved" ribbon — set on at most one tier
    }
  ],

  // A separate, un-priced-per-piece section — hampers are build-your-own,
  // so this shows examples rather than a fixed grid of exact prices.
  hamper: {
    title: 'Custom Hampers',
    note: 'Pair your cake with a birthday card, roses, or a flower bouquet — tell us the occasion and we\'ll build it around it.',
    priceNote: 'Starting from ₹999 · fully customisable',
    folderId: '1E-bibNhzE11afWh3GixO77fcOXWFa7wE'
  }
};