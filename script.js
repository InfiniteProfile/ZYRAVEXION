(() => {
  'use strict';

  const BATCH_SIZE = 24;
  const MAX_CHUNKS = 8;
  const PRELOAD_PX = 1250;
  const PREVIOUS_PRELOAD_PX = 650;
  const STORAGE_KEYS = { glow: 'zyravexion-glow', compact: 'zyravexion-compact' };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const feedView = $('#feed-view');
  const detailView = $('#detail-view');
  const chunkStack = $('#chunk-stack');
  const topSpacer = $('#top-spacer');
  const sentinel = $('#feed-sentinel');
  const searchDialog = $('#search-dialog');
  const searchInput = $('#profile-search-input');
  const searchError = $('#search-error');
  const searchHint = $('#search-hint');
  const toastRegion = $('#toast-region');

  const classifications = [
    'Celestial Wanderer', 'Voidborn Entity', 'Astral Guardian', 'Nebula Architect',
    'Quantum Traveler', 'Dimensional Phantom', 'Stellar Sentinel', 'Eternal Observer',
    'Cosmic Architect', 'Abyssal Entity', 'Radiant Ascendant', 'Interdimensional Nomad',
    'Chrono Wanderer', 'Eclipse Sovereign', 'Infinity Seeker'
  ];
  const firstNameParts = ['Zyra', 'Vael', 'Nyx', 'Astra', 'Vex', 'Orin', 'Kyr', 'Aev', 'Thyr', 'Xylo', 'Vel', 'Ely', 'Zev', 'Oryn', 'Cael', 'Novi', 'Rhyx', 'Ily', 'Auri', 'Drax', 'Sere', 'Myrr', 'Quor', 'Vey'];
  const secondNameParts = ['vexion', 'aeris', 'thar', 'onyx', 'evara', 'ion', 'ythe', 'orix', 'aeth', 'vane', 'yra', 'exis', 'aris', 'ethys', 'une', 'avor', 'elion', 'yx', 'astra', 'nox', 'eon', 'ivex', 'oryn', 'ael'];
  const adjectives = ['silent', 'radiant', 'forgotten', 'untethered', 'luminous', 'ancient', 'unwritten', 'veiled', 'unbound', 'distant', 'shifting', 'eternal', 'unseen', 'awakened', 'astral', 'hollow', 'resonant', 'hidden'];
  const nouns = ['horizon', 'nebula', 'threshold', 'eclipse', 'signal', 'orbit', 'paradox', 'constellation', 'dimension', 'afterglow', 'void', 'singularity', 'echo', 'starfield', 'tide', 'rift', 'prism', 'infinity'];
  const origins = ['beyond the violet event horizon', 'inside a forgotten celestial archive', 'where starlight folds into itself', 'at the edge of an uncharted dimension', 'in the quiet between two universes', 'within a nebula that remembers time', 'past the final echo of an ancient star', 'beneath the surface of a quantum sea', 'inside a corridor of suspended light', 'beyond the boundary of known reality'];
  const energies = ['Violet Flux', 'Cyan Pulse', 'Astral Static', 'Event-Horizon Drift', 'Quantum Bloom', 'Eclipse Current', 'Nebula Resonance', 'Celestial Harmonic', 'Void Frequency', 'Prismatic Surge'];
  const symbols = ['✦', '⌘', '⟡', '⟁', '◈', '⌬', '✧', '⧖', '⋇', '⟢', '⦿', '⧫'];
  const palettes = ['#8B5CF6', '#A855F7', '#22D3EE', '#EC4899', '#818CF8', '#67E8F9', '#C084FC', '#A78BFA', '#E879F9', '#7DD3FC'];
  let avatarSerial = 0;
  let savedFeedScroll = 0;
  let activeProfileId = null;
  let nextFeedId = '1';
  let firstRenderedId = '1';
  let loadingForward = false;
  let loadingBackward = false;
  let intersectionObserver = null;
  let fallbackTimer = 0;
  let scrollFrame = 0;
  let toastSequence = 0;
  let routeWasDetail = false;

  // IDs are intentionally kept as decimal strings. These helpers never coerce an ID to Number.
  function normalizeDecimal(value) {
    const digits = String(value).trim();
    if (!/^\d+$/.test(digits)) return null;
    const normalized = digits.replace(/^0+(?=\d)/, '');
    return normalized === '0' ? '0' : normalized;
  }

  function isValidPositiveId(value) {
    const normalized = normalizeDecimal(value);
    return normalized !== null && normalized !== '0';
  }

  function incrementDecimal(value) {
    const normalized = normalizeDecimal(value);
    if (normalized === null) throw new TypeError('Expected a decimal integer string.');
    if (normalized === '0') return '1';
    const digits = normalized.split('');
    let carry = 1;
    for (let i = digits.length - 1; i >= 0 && carry; i -= 1) {
      const digit = digits[i].charCodeAt(0) - 48 + carry;
      digits[i] = String(digit % 10);
      carry = digit >= 10 ? 1 : 0;
    }
    if (carry) digits.unshift('1');
    return digits.join('');
  }

  function decrementDecimal(value) {
    const normalized = normalizeDecimal(value);
    if (normalized === null || normalized === '0') throw new TypeError('Expected a positive decimal integer string.');
    if (normalized === '1') return '0';
    const digits = normalized.split('');
    let borrow = 1;
    for (let i = digits.length - 1; i >= 0 && borrow; i -= 1) {
      const digit = digits[i].charCodeAt(0) - 48 - borrow;
      if (digit < 0) { digits[i] = '9'; borrow = 1; }
      else { digits[i] = String(digit); borrow = 0; }
    }
    return digits.join('').replace(/^0+(?=\d)/, '');
  }

  function decimalCompare(a, b) {
    const left = normalizeDecimal(a);
    const right = normalizeDecimal(b);
    if (left === null || right === null) throw new TypeError('Expected decimal integer strings.');
    if (left.length !== right.length) return left.length < right.length ? -1 : 1;
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }

  function hashText(text, initial = 2166136261) {
    let hash = initial >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
      hash ^= hash >>> 13;
    }
    return hash >>> 0;
  }

  function mixSeed(seed, salt) {
    let x = (seed ^ salt ^ 0x9e3779b9) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  function pick(list, seed) {
    // Bitwise XOR can be signed in JavaScript; normalize before choosing an array entry.
    return list[(seed >>> 0) % list.length];
  }

  function generateProfile(inputId) {
    const id = normalizeDecimal(inputId);
    if (id === null || id === '0') throw new TypeError('A profile ID must be a positive whole number.');
    const seed = hashText(id);
    const h2 = mixSeed(seed, 0x85ebca6b);
    const h3 = hashText(id, 0x27d4eb2d);
    const h4 = mixSeed(h2, h3);
    const name = `${pick(firstNameParts, seed)}${pick(secondNameParts, h2)}-${(h3 % 97).toString().padStart(2, '0')}`;
    const classification = pick(classifications, h2 >>> 3);
    const adjective = pick(adjectives, h3 >>> 5);
    const noun = pick(nouns, h4 >>> 7);
    const origin = pick(origins, seed ^ h4);
    const energy = pick(energies, h3 ^ h2);
    const symbol = pick(symbols, h4 >>> 4);
    const accent = pick(palettes, h2 ^ h4);
    const phase = (h3 % 360);
    const frequency = 100 + (h4 % 900);
    const trait = pick(['Memory Fragments', 'Phase Control', 'Gravity Weaving', 'Time Echo', 'Void Cartography', 'Light Refraction', 'Quantum Listening', 'Astral Navigation', 'Dream Synthesis', 'Dimensional Folding'], h2 >>> 9);
    const description = `A ${adjective} presence drifting through the ${noun}, originating ${origin}. Its signal carries a ${energy.toLowerCase()} that bends the edges of perception.`;
    const extendedDescription = `${name} exists as a ${adjective} intelligence ${origin}. Classified as a ${classification.toLowerCase()}, this identity resonates at ${frequency} astral units and follows a phase signature of ${phase}°. Its defining expression is ${trait.toLowerCase()}; its signal is recorded as ${energy.toLowerCase()}. No journey through this universe needs to end at a final identity.`;
    return {
      id,
      identityKey: id,
      name,
      classification,
      description,
      extendedDescription,
      adjective,
      noun,
      origin,
      energy,
      symbol,
      accent,
      phase,
      frequency,
      trait,
      seed,
      seed2: h2,
      seed3: h3,
      seed4: h4
    };
  }

  function avatarSvg(profile, large = false) {
    const uid = `zv-${++avatarSerial}`;
    const { seed, seed2, seed3, seed4, accent, phase } = profile;
    const hue = phase;
    const hue2 = (phase + 58 + seed2 % 110) % 360;
    const tilt = (seed3 % 70) - 35;
    const cx = 80 + (seed2 % 11) - 5;
    const cy = 78 + (seed3 % 9) - 4;
    const ringRx = 36 + (seed2 % 15);
    const ringRy = 12 + (seed3 % 12);
    const coreR = 22 + (seed4 % 9);
    const pointCount = 4 + (seed % 5);
    let stars = '';
    for (let i = 0; i < pointCount; i += 1) {
      const sx = 19 + ((seed2 + i * 37) % 122);
      const sy = 19 + ((seed3 + i * 29) % 122);
      const sr = 0.8 + ((seed4 + i * 3) % 9) / 10;
      stars += `<circle cx="${sx}" cy="${sy}" r="${sr.toFixed(1)}" fill="#F5F3FF" opacity="${(.28 + ((seed + i * 7) % 55) / 100).toFixed(2)}"/>`;
    }
    const shape = seed % 4;
    let mask = '';
    if (shape === 0) {
      mask = `<path d="M${cx - 30} ${cy - 15} Q${cx} ${cy - 47} ${cx + 30} ${cy - 15} L${cx + 23} ${cy + 23} Q${cx} ${cy + 39} ${cx - 23} ${cy + 23}Z" fill="url(#${uid}-main)" stroke="#FFFFFF" stroke-opacity=".48" stroke-width=".8"/><path d="M${cx - 21} ${cy - 5} Q${cx} ${cy - 18} ${cx + 21} ${cy - 5} L${cx + 13} ${cy + 9} Q${cx} ${cy + 14} ${cx - 13} ${cy + 9}Z" fill="#080713" stroke="url(#${uid}-line)" stroke-width="1.5"/><path d="M${cx - 13} ${cy + 23} L${cx} ${cy + 13} L${cx + 13} ${cy + 23}" fill="none" stroke="#EDE9FE" stroke-opacity=".7"/>`;
    } else if (shape === 1) {
      mask = `<path d="M${cx} ${cy - 38} L${cx + 30} ${cy - 4} L${cx + 19} ${cy + 31} L${cx} ${cy + 39} L${cx - 19} ${cy + 31} L${cx - 30} ${cy - 4}Z" fill="url(#${uid}-main)" stroke="#FFFFFF" stroke-opacity=".48" stroke-width=".8"/><path d="M${cx - 21} ${cy - 7} L${cx - 4} ${cy - 1} L${cx - 8} ${cy + 7} L${cx - 22} ${cy + 3}Z" fill="#070610"/><path d="M${cx + 21} ${cy - 7} L${cx + 4} ${cy - 1} L${cx + 8} ${cy + 7} L${cx + 22} ${cy + 3}Z" fill="#070610"/><path d="M${cx - 10} ${cy + 20} L${cx} ${cy + 12} L${cx + 10} ${cy + 20}" fill="none" stroke="#FFFFFF" stroke-opacity=".65"/>`;
    } else if (shape === 2) {
      mask = `<circle cx="${cx}" cy="${cy}" r="${coreR + 9}" fill="url(#${uid}-main)" stroke="#FFFFFF" stroke-opacity=".36" stroke-width=".8"/><path d="M${cx - 31} ${cy - 1} Q${cx - 9} ${cy - 23} ${cx} ${cy - 2} Q${cx + 14} ${cy - 23} ${cx + 31} ${cy - 1} Q${cx + 11} ${cy + 21} ${cx} ${cy + 3} Q${cx - 12} ${cy + 21} ${cx - 31} ${cy - 1}Z" fill="#070610" stroke="url(#${uid}-line)" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="${coreR / 2}" fill="url(#${uid}-core)"/>`;
    } else {
      mask = `<path d="M${cx} ${cy - 41} L${cx + 37} ${cy - 8} L${cx + 14} ${cy + 35} L${cx - 14} ${cy + 35} L${cx - 37} ${cy - 8}Z" fill="url(#${uid}-main)" stroke="#FFFFFF" stroke-opacity=".48" stroke-width=".8"/><path d="M${cx - 25} ${cy - 7} L${cx - 5} ${cy - 2} L${cx - 9} ${cy + 8} L${cx - 25} ${cy + 5}Z M${cx + 25} ${cy - 7} L${cx + 5} ${cy - 2} L${cx + 9} ${cy + 8} L${cx + 25} ${cy + 5}Z" fill="#080713"/><path d="M${cx - 12} ${cy + 19} L${cx} ${cy + 7} L${cx + 12} ${cy + 19}" fill="none" stroke="#FFFFFF" stroke-opacity=".7"/>`;
    }
    const extra = (seed4 % 3 === 0)
      ? `<path d="M${cx - 39} ${cy - 25} Q${cx - 65} ${cy - 50} ${cx - 50} ${cy - 65} M${cx + 39} ${cy - 25} Q${cx + 65} ${cy - 50} ${cx + 50} ${cy - 65}" fill="none" stroke="url(#${uid}-line)" stroke-width="2" stroke-linecap="round"/>`
      : (seed4 % 3 === 1)
        ? `<path d="M${cx - 43} ${cy + 30} L${cx - 32} ${cy + 40} L${cx - 21} ${cy + 30} M${cx + 43} ${cy + 30} L${cx + 32} ${cy + 40} L${cx + 21} ${cy + 30}" fill="none" stroke="url(#${uid}-line)" stroke-width="1.4"/>`
        : `<path d="M${cx} ${cy - 57} L${cx + 7} ${cy - 45} L${cx} ${cy - 33} L${cx - 7} ${cy - 45}Z" fill="url(#${uid}-line)" opacity=".85"/>`;
    return `<svg viewBox="0 0 160 160" role="img" aria-label="Procedural cosmic avatar" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="${uid}-space" cx="37%" cy="30%" r="80%"><stop offset="0" stop-color="${accent}" stop-opacity=".25"/><stop offset=".55" stop-color="#161026" stop-opacity=".8"/><stop offset="1" stop-color="#070610"/></radialGradient>
        <linearGradient id="${uid}-main" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F5F3FF" stop-opacity=".9"/><stop offset=".28" stop-color="hsl(${hue} 92% 72%)"/><stop offset=".68" stop-color="hsl(${hue2} 85% 49%)"/><stop offset="1" stop-color="#151024"/></linearGradient>
        <linearGradient id="${uid}-line" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="#22D3EE"/></linearGradient>
        <radialGradient id="${uid}-core"><stop stop-color="#FFFFFF"/><stop offset=".38" stop-color="${accent}"/><stop offset="1" stop-color="#22133B"/></radialGradient>
      </defs>
      <circle cx="80" cy="80" r="75" fill="url(#${uid}-space)"/>
      <circle cx="80" cy="80" r="71" fill="none" stroke="${accent}" stroke-opacity=".27" stroke-width=".8"/>
      ${stars}
      <g transform="rotate(${tilt} 80 80)">
        <ellipse cx="80" cy="80" rx="${ringRx + 9}" ry="${ringRy + 8}" fill="none" stroke="url(#${uid}-line)" stroke-opacity=".65" stroke-width="1.4" transform="rotate(-29 80 80)"/>
        <ellipse cx="80" cy="80" rx="${ringRx + 17}" ry="${ringRy + 14}" fill="none" stroke="#EDE9FE" stroke-opacity=".23" stroke-width=".7" transform="rotate(44 80 80)"/>
        ${extra}
        ${mask}
      </g>
      <path d="M25 113 Q80 ${118 + (seed % 14)} 135 113" fill="none" stroke="url(#${uid}-line)" stroke-opacity=".45" stroke-width=".8"/>
      <circle cx="80" cy="80" r="3" fill="#FFFFFF" opacity=".85"/>
    </svg>`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function makeCard(profile) {
    const card = document.createElement('article');
    card.className = 'profile-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `Open ${profile.name}, profile ${profile.id}`);
    card.dataset.profileId = profile.id;
    card.style.setProperty('--profile-accent', profile.accent);
    card.innerHTML = `
      <div class="card-topline"><span class="card-serial">IDENTITY SIGNAL</span><span class="energy-mark" aria-hidden="true">${profile.symbol}</span></div>
      <div class="avatar-frame">${avatarSvg(profile)}</div>
      <h3 class="profile-name">${escapeHTML(profile.name)}</h3>
      <div class="profile-class">${escapeHTML(profile.classification.toUpperCase())}</div>
      <p class="profile-description">${escapeHTML(profile.description)}</p>
      <div class="card-bottom"><span class="card-id" title="Exact profile ID">ID · ${escapeHTML(profile.id)}</span><span class="card-arrow" aria-hidden="true">↗</span></div>`;
    return card;
  }

  function makeChunk(startId, count) {
    const chunk = document.createElement('section');
    chunk.className = 'profile-grid';
    chunk.setAttribute('aria-label', 'Generated cosmic identities');
    chunk.dataset.startId = startId;
    const fragment = document.createDocumentFragment();
    let id = startId;
    for (let index = 0; index < count; index += 1) {
      const profile = generateProfile(id);
      fragment.appendChild(makeCard(profile));
      id = incrementDecimal(id);
    }
    chunk.appendChild(fragment);
    return { element: chunk, nextId: id };
  }

  function updateFirstRenderedId() {
    const firstChunk = $('.profile-grid', chunkStack);
    if (firstChunk) firstRenderedId = firstChunk.dataset.startId;
    else firstRenderedId = nextFeedId;
  }

  function isNearBottom() {
    return document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < PRELOAD_PX;
  }

  function appendForwardChunk() {
    const result = makeChunk(nextFeedId, BATCH_SIZE);
    chunkStack.appendChild(result.element);
    nextFeedId = result.nextId;
    updateFirstRenderedId();
    trimOldChunks();
    if (intersectionObserver) intersectionObserver.observe(sentinel);
    return result.element;
  }

  function trimOldChunks() {
    const chunks = $$('.profile-grid', chunkStack);
    while (chunks.length > MAX_CHUNKS) {
      const oldest = chunks.shift();
      const height = oldest.getBoundingClientRect().height;
      const margin = parseFloat(getComputedStyle(oldest).marginBottom) || 0;
      const stackGap = parseFloat(getComputedStyle(chunkStack).rowGap) || 0;
      topSpacer.style.height = `${Math.max(0, topSpacer.getBoundingClientRect().height + height + Math.max(margin, stackGap))}px`;
      oldest.remove();
    }
    updateFirstRenderedId();
    // Keep physical scroll coordinates within a comfortable range for long sessions.
    const spacerHeight = topSpacer.getBoundingClientRect().height;
    if (spacerHeight > 900000) {
      const shift = spacerHeight - 260000;
      const newHeight = spacerHeight - shift;
      topSpacer.style.height = `${newHeight}px`;
      const nextScroll = Math.max(0, window.scrollY - shift);
      window.scrollTo(0, nextScroll);
    }
  }

  function shouldLoadPrevious() {
    const spacerHeight = topSpacer.getBoundingClientRect().height;
    if (spacerHeight <= 0 || firstRenderedId === '1') return false;
    const spacerTop = topSpacer.getBoundingClientRect().top + window.scrollY;
    const viewportBottom = window.scrollY + window.innerHeight;
    const spacerEnd = spacerTop + spacerHeight;
    // Only prepend while approaching the first retained chunk from above;
    // being far below the spacer (normal downward browsing) must not trigger it.
    return viewportBottom >= spacerEnd - PREVIOUS_PRELOAD_PX && window.scrollY <= spacerEnd;
  }

  function prependBackwardChunk() {
    if (loadingBackward || firstRenderedId === '1') return false;
    loadingBackward = true;
    try {
      const ids = [];
      let id = firstRenderedId;
      for (let i = 0; i < BATCH_SIZE && id !== '1'; i += 1) {
        id = decrementDecimal(id);
        ids.push(id);
      }
      ids.reverse();
      if (!ids.length) return false;
      const result = makeChunk(ids[0], ids.length);
      const spacerHeight = topSpacer.getBoundingClientRect().height;
      chunkStack.insertBefore(result.element, chunkStack.firstChild);
      // Measure after insertion; detached grid elements report zero height.
      const previousHeight = result.element.getBoundingClientRect().height;
      const stackGap = parseFloat(getComputedStyle(chunkStack).rowGap) || 0;
      const contribution = previousHeight + stackGap;
      if (spacerHeight >= contribution) {
        topSpacer.style.height = `${spacerHeight - contribution}px`;
      } else {
        topSpacer.style.height = '0px';
        window.scrollBy(0, contribution - spacerHeight);
      }
      updateFirstRenderedId();
      const chunks = $$('.profile-grid', chunkStack);
      // If the user kept browsing far backwards, use the same bounded window in the other direction.
      while (chunks.length > MAX_CHUNKS) {
        const newest = chunks.pop();
        const height = newest.getBoundingClientRect().height;
        newest.remove();
        // This rare reverse overflow is handled by dropping the far edge; the feed cursor remains exact.
        nextFeedId = newest.dataset.startId;
      }
      return true;
    } finally {
      loadingBackward = false;
    }
  }

  async function loadForwardQueue() {
    if (loadingForward || feedView.hidden) return;
    loadingForward = true;
    try {
      let runs = 0;
      do {
        appendForwardChunk();
        runs += 1;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      } while (!feedView.hidden && runs < 5 && isNearBottom());
    } finally {
      loadingForward = false;
      // Re-check after resetting the guard; a fast scroll can finish while the queue was active.
      if (!feedView.hidden && isNearBottom()) {
        clearTimeout(fallbackTimer);
        fallbackTimer = window.setTimeout(() => { loadForwardQueue(); }, 40);
      }
    }
  }

  function handleFeedScroll() {
    if (feedView.hidden || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (isNearBottom()) loadForwardQueue();
      if (shouldLoadPrevious()) prependBackwardChunk();
    });
  }

  function setupInfiniteFeed() {
    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadForwardQueue();
      }, { root: null, rootMargin: `${PRELOAD_PX}px 0px ${PRELOAD_PX}px 0px`, threshold: 0 });
      intersectionObserver.observe(sentinel);
    }
    window.addEventListener('scroll', handleFeedScroll, { passive: true });
    window.addEventListener('resize', () => {
      // Resize affects card height; the feed stays live and the fallback recalculates positions.
      handleFeedScroll();
    }, { passive: true });
    // Independent fallback protects against an observer that stops firing or a detached sentinel.
    window.setInterval(() => {
      // The independent fallback only runs while the feed is visible.
      if (feedView.hidden) return;
      if (isNearBottom()) loadForwardQueue();
      if (shouldLoadPrevious()) prependBackwardChunk();
    }, 900);
    appendForwardChunk();
    requestAnimationFrame(() => { if (isNearBottom()) loadForwardQueue(); });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.dataset.toast = String(++toastSequence);
    toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  async function copyText(text, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Clipboard permission is not available.');
      }
      showToast(successMessage);
    } catch (error) {
      showToast('Clipboard access was blocked by this browser.');
    }
  }

  function profileUrl(id) {
    return `${window.location.origin}${window.location.pathname}${window.location.search}#/profile/${id}`;
  }

  function renderDetail(id) {
    const profile = generateProfile(id);
    activeProfileId = profile.id;
    const previousId = profile.id === '1' ? null : decrementDecimal(profile.id);
    const nextId = incrementDecimal(profile.id);
    detailView.style.setProperty('--profile-accent', profile.accent);
    detailView.innerHTML = `
      <button class="detail-back" id="back-to-feed" type="button"><span aria-hidden="true">←</span> Return to the identity stream</button>
      <article class="detail-panel">
        <div class="detail-topline"><span>ZYRAVEXION / IDENTITY ARCHIVE</span><span>RECORD VERIFIED · ${escapeHTML(profile.symbol)}</span></div>
        <div class="detail-identity">
          <div class="detail-avatar">${avatarSvg(profile, true)}</div>
          <div class="detail-main">
            <div class="eyebrow small-eyebrow"><span class="eyebrow-dot"></span> COSMIC ENTITY</div>
            <h1 class="detail-title">${escapeHTML(profile.name)}</h1>
            <div class="detail-class">${escapeHTML(profile.classification.toUpperCase())}</div>
            <div class="detail-id-label">EXACT PROFILE ID</div>
            <code class="detail-id" id="detail-profile-id">${escapeHTML(profile.id)}</code>
          </div>
        </div>
        <p class="detail-description">${escapeHTML(profile.extendedDescription)}</p>
        <div class="trait-grid">
          <div class="trait-box"><span>Energy signature</span><b>${escapeHTML(profile.energy)}</b></div>
          <div class="trait-box"><span>Primary trait</span><b>${escapeHTML(profile.trait)}</b></div>
          <div class="trait-box"><span>Phase index</span><b>${profile.phase}°</b></div>
          <div class="trait-box"><span>Signal frequency</span><b>${profile.frequency} astral units</b></div>
          <div class="trait-box"><span>Origin</span><b>${escapeHTML(profile.origin)}</b></div>
          <div class="trait-box"><span>Identity key</span><b>Decimal / ${profile.id.length} digit${profile.id.length === 1 ? '' : 's'}</b></div>
        </div>
        <div class="detail-actions">
          <button class="primary-button" id="copy-profile-id" type="button">Copy profile ID <span aria-hidden="true">⧉</span></button>
          <button class="secondary-button" id="copy-profile-link" type="button">Copy profile link <span aria-hidden="true">↗</span></button>
          <button class="secondary-button" id="detail-random" type="button">Random identity <span aria-hidden="true">✧</span></button>
        </div>
        <div class="detail-navigation">
          <button class="secondary-button" id="previous-profile" type="button" ${previousId ? '' : 'disabled'}>← Previous</button>
          <span class="nav-id-note">IDENTITIES ARE GENERATED ON DEMAND</span>
          <button class="secondary-button" id="next-profile" type="button">Next →</button>
        </div>
      </article>`;
    $('#back-to-feed', detailView).addEventListener('click', goHomeAndRestore);
    $('#copy-profile-id', detailView).addEventListener('click', () => copyText(profile.id, 'Exact profile ID copied.'));
    $('#copy-profile-link', detailView).addEventListener('click', () => copyText(profileUrl(profile.id), 'Profile link copied.'));
    $('#detail-random', detailView).addEventListener('click', openRandomIdentity);
    $('#next-profile', detailView).addEventListener('click', () => navigateToProfile(nextId));
    if (previousId) $('#previous-profile', detailView).addEventListener('click', () => navigateToProfile(previousId));
  }

  function route() {
    const rawHash = window.location.hash || '#/';
    const match = rawHash.match(/^#\/profile\/(\d+)$/);
    if (match) {
      const id = normalizeDecimal(match[1]);
      if (id === null || id === '0') {
        navigateHome(false);
        showToast('That route is not a valid positive profile ID.');
        return;
      }
      if (match[1] !== id) {
        const baseUrl = window.location.href.split('#')[0];
        window.history.replaceState(window.history.state, '', `${baseUrl}#/profile/${id}`);
      }
      routeWasDetail = true;
      feedView.hidden = true;
      detailView.hidden = false;
      renderDetail(id);
      window.scrollTo(0, 0);
      $$('.mobile-nav-item').forEach((item) => item.classList.remove('active'));
      return;
    }
    routeWasDetail = false;
    detailView.hidden = true;
    feedView.hidden = false;
    activeProfileId = null;
    $$('.mobile-nav-item').forEach((item) => item.classList.toggle('active', item.id === '' && item.tagName === 'A'));
    if (savedFeedScroll > 0) requestAnimationFrame(() => window.scrollTo(0, savedFeedScroll));
    else if (window.history.state && typeof window.history.state.zyravexionScroll === 'number') {
      requestAnimationFrame(() => window.scrollTo(0, window.history.state.zyravexionScroll));
    }
    if (isNearBottom()) loadForwardQueue();
  }

  function navigateToProfile(inputId) {
    const id = normalizeDecimal(inputId);
    if (id === null || id === '0') {
      showToast('Enter a positive whole-number ID to open an identity.');
      return;
    }
    if (!feedView.hidden) savedFeedScroll = window.scrollY;
    window.history.replaceState({ ...(window.history.state || {}), zyravexionScroll: savedFeedScroll }, '', window.location.href);
    if (window.location.hash === `#/profile/${id}`) {
      route();
    } else {
      window.location.hash = `/profile/${id}`;
    }
  }

  function navigateHome(restore = true) {
    if (restore) savedFeedScroll = Math.max(savedFeedScroll, window.history.state?.zyravexionScroll || 0);
    if (window.location.hash === '#/' || window.location.hash === '') {
      route();
    } else {
      window.location.hash = '/';
    }
  }

  function goHomeAndRestore() {
    navigateHome(true);
  }

  function randomPositiveId() {
    // A bounded random length plus random decimal digits is a sensible sampler over an infinite set.
    const bytes = new Uint8Array(1);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    const length = 5 + (bytes[0] % 32); // 5–36 digits; length is not a profile-ID limit.
    const digits = new Uint8Array(length);
    (window.crypto || window.msCrypto).getRandomValues(digits);
    let id = String(1 + (digits[0] % 9));
    for (let i = 1; i < digits.length; i += 1) id += String(digits[i] % 10);
    return id;
  }

  function openRandomIdentity() {
    navigateToProfile(randomPositiveId());
  }

  function openSearch() {
    if (searchDialog.open) return;
    searchError.textContent = '';
    searchHint.textContent = 'Digits only · No digit limit';
    if (typeof searchDialog.showModal === 'function') searchDialog.showModal();
    else searchDialog.setAttribute('open', '');
    updateVisualViewportHeight();
    window.setTimeout(() => { searchInput.focus({ preventScroll: true }); }, 40);
  }

  function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (dialogId === 'search-dialog') $('#open-search').focus({ preventScroll: true });
  }

  function submitSearch(event) {
    event.preventDefault();
    const entered = searchInput.value;
    const normalized = normalizeDecimal(entered);
    if (normalized === null || normalized === '0') {
      searchError.textContent = 'Enter digits for a positive whole number.';
      searchHint.textContent = 'Your input has been kept. Try again.';
      searchInput.setAttribute('aria-invalid', 'true');
      searchInput.focus({ preventScroll: true });
      return;
    }
    searchInput.removeAttribute('aria-invalid');
    searchError.textContent = '';
    closeDialog('search-dialog');
    navigateToProfile(normalized);
  }

  function updateVisualViewportHeight() {
    if (!window.visualViewport) return;
    document.documentElement.style.setProperty('--visual-height', `${window.visualViewport.height}px`);
  }

  function openInfo() {
    const dialog = $('#info-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function openAppearance() {
    const dialog = $('#appearance-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function applySetting(key, enabled) {
    try { localStorage.setItem(key, enabled ? '1' : '0'); } catch (_) { /* Storage may be disabled; the setting still works for this session. */ }
    return enabled;
  }

  function readSetting(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value === '1';
    } catch (_) { return fallback; }
  }

  function setupSettings() {
    const glowToggle = $('#glow-toggle');
    const denseToggle = $('#dense-toggle');
    glowToggle.checked = readSetting(STORAGE_KEYS.glow, true);
    denseToggle.checked = readSetting(STORAGE_KEYS.compact, false);
    document.documentElement.style.setProperty('--glow-strength', glowToggle.checked ? '1' : '0');
    document.body.classList.toggle('compact-stream', denseToggle.checked);
    glowToggle.addEventListener('change', () => {
      document.documentElement.style.setProperty('--glow-strength', applySetting(STORAGE_KEYS.glow, glowToggle.checked) ? '1' : '0');
    });
    denseToggle.addEventListener('change', () => {
      document.body.classList.toggle('compact-stream', applySetting(STORAGE_KEYS.compact, denseToggle.checked));
    });
  }

  function setUpActions() {
    $('#open-search').addEventListener('click', openSearch);
    $('#mobile-search').addEventListener('click', openSearch);
    $('#random-identity').addEventListener('click', openRandomIdentity);
    $('#mobile-random').addEventListener('click', openRandomIdentity);
    $('#hero-discover').addEventListener('click', openRandomIdentity);
    $('#open-info').addEventListener('click', openInfo);
    $('#mobile-info').addEventListener('click', openInfo);
    $('#open-appearance').addEventListener('click', openAppearance);
    $('#search-form').addEventListener('submit', submitSearch);
    $('#clear-search').addEventListener('click', () => {
      searchInput.value = '';
      searchError.textContent = '';
      searchInput.removeAttribute('aria-invalid');
      searchInput.focus({ preventScroll: true });
    });
    $$('[data-example-id]').forEach((button) => button.addEventListener('click', () => {
      searchInput.value = button.dataset.exampleId;
      searchError.textContent = '';
      searchInput.removeAttribute('aria-invalid');
      searchInput.focus({ preventScroll: true });
    }));
    $$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.closeDialog)));
    [searchDialog, $('#info-dialog'), $('#appearance-dialog')].forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeDialog(dialog.id);
      });
      dialog.addEventListener('cancel', () => {
        if (dialog.id === 'search-dialog') $('#open-search').focus({ preventScroll: true });
      });
    });
    chunkStack.addEventListener('click', (event) => {
      const card = event.target.closest('.profile-card');
      if (card) navigateToProfile(card.dataset.profileId);
    });
    chunkStack.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.profile-card')) {
        event.preventDefault();
        navigateToProfile(event.target.dataset.profileId);
      }
    });
    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', () => { savedFeedScroll = window.history.state?.zyravexionScroll || savedFeedScroll; route(); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateVisualViewportHeight, { passive: true });
      window.visualViewport.addEventListener('scroll', updateVisualViewportHeight, { passive: true });
    }
  }

  // Small public surface makes the exact-string identity engine straightforward to inspect and test.
  window.Zyravexion = Object.freeze({
    normalizeDecimal,
    isValidPositiveId,
    incrementDecimal,
    decrementDecimal,
    decimalCompare,
    generateProfile,
    avatarSvg
  });

  setUpActions();
  setupSettings();
  setupInfiniteFeed();
  route();
})();
