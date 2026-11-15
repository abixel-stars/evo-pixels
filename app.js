/* Evo Pixels — wallet connect only, starter picker, section reveals.
   Wallet: no transactions, no on-chain calls. The connect button simply
   links a Phantom / Solflare wallet so the site can show the connected
   address. @solana/web3.js is loaded via CDN (see index.html) but is NOT
   required for connecting; the injected provider (window.solana /
   window.solflare) does the work. If no wallet is installed, the user
   gets a clear message with a link to install Phantom. */

(function () {
  'use strict';

  /* ---------- wallet connect (unchanged behaviour) ---------- */
  var statusEl = document.getElementById('wallet-status');
  var buttons = [
    document.getElementById('wallet-btn-nav'),
    document.getElementById('wallet-btn-hero'),
    document.getElementById('wallet-btn-shop'),
    document.getElementById('wallet-btn-footer'),
  ].filter(Boolean);

  var connectedAddress = null;

  function shortAddress(addr) {
    return addr.slice(0, 4) + '...' + addr.slice(-4);
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('error', !!isError);
  }

  function setButtons(label, disabled) {
    buttons.forEach(function (b) {
      b.textContent = label;
      b.disabled = !!disabled;
    });
  }

  function getProvider() {
    if (window.solana && window.solana.isPhantom) return { provider: window.solana, name: 'Phantom' };
    if (window.solflare && window.solflare.isSolflare) return { provider: window.solflare, name: 'Solflare' };
    if (window.solana) return { provider: window.solana, name: 'Solana wallet' };
    return null;
  }

  async function connectWallet() {
    var found = getProvider();
    if (!found) {
      setStatus('No Solana wallet found. Install Phantom (phantom.app) or Solflare, then try again.', true);
      return;
    }
    try {
      setButtons('Connecting...', true);
      var resp = await found.provider.connect();
      connectedAddress = resp.publicKey.toString();
      setButtons(shortAddress(connectedAddress), false);
      setStatus('Connected with ' + found.name + ': ' + shortAddress(connectedAddress));
    } catch (err) {
      setButtons('Connect Wallet', false);
      setStatus('Connection cancelled or failed. Try again.', true);
    }
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (connectedAddress) {
        setStatus('Already connected: ' + shortAddress(connectedAddress));
        return;
      }
      connectWallet();
    });
  });

  // "Play on Telegram" — the Mini App does not exist yet. Do not invent a
  // URL: the link is a placeholder that explains it is coming soon.
  var playBtn = document.getElementById('play-telegram-btn');
  if (playBtn) {
    playBtn.addEventListener('click', function (e) {
      e.preventDefault();
      setStatus('The Telegram Mini App is coming soon. The Play link will appear here once it is live.');
    });
  }

  /* ---------- starter picker ---------- */
  var CREATURES = [
    { src: 'assets/creature-3.png', alt: 'Evo #3, teal body, wink face, gold glow', caption: 'Evo #3 · Teal · Wink · Gold Glow · Rare' },
    { src: 'assets/creature-4.png', alt: 'Evo #4, violet body, wink face, silver crown', caption: 'Evo #4 · Violet · Wink · Silver Crown · Rare' },
    { src: 'assets/creature-1.png', alt: 'Evo #1, sky body, determined face, red beanie', caption: 'Evo #1 · Sky · Determined · Red Beanie · Common' },
    { src: 'assets/creature-2.png', alt: 'Evo #2, lime body, happy face, bat wings', caption: 'Evo #2 · Lime · Happy · Bat Wings · Uncommon' },
    { src: 'assets/creature-5.png', alt: 'Evo #5, mint body, wink face, big horns', caption: 'Evo #5 · Mint · Wink · Big Horns · Uncommon' },
    { src: 'assets/creature-8.png', alt: 'Evo #8, coral body, mischievous face, red beanie', caption: 'Evo #8 · Coral · Mischievous · Red Beanie · Uncommon' },
    { src: 'assets/creature-16.png', alt: 'Evo #16, orange body, determined face, big horns', caption: 'Evo #16 · Orange · Determined · Big Horns · Uncommon' },
    { src: 'assets/creature-17.png', alt: 'Evo #17, pink body, happy face, silver crown', caption: 'Evo #17 · Pink · Happy · Silver Crown · Uncommon' },
  ];
  var pickerImg = document.getElementById('picker-img');
  var pickerCaption = document.getElementById('picker-caption');
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.picker-thumb'));
  var frame = document.querySelector('.picker-frame');
  var current = 0;
  var timer = null;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(i) {
    current = (i + CREATURES.length) % CREATURES.length;
    var c = CREATURES[current];
    pickerImg.classList.add('is-fading');
    window.setTimeout(function () {
      pickerImg.src = c.src;
      pickerImg.alt = c.alt;
      pickerCaption.textContent = c.caption;
      pickerImg.classList.remove('is-fading');
    }, 200);
    thumbs.forEach(function (t, k) {
      t.classList.toggle('is-active', k === current);
    });
  }

  function restartCycle() {
    window.clearInterval(timer);
    if (reduceMotion) return;
    timer = window.setInterval(function () {
      if (document.hidden) return;
      show(current + 1);
    }, 3000);
  }

  if (pickerImg && thumbs.length) {
    thumbs.forEach(function (t, k) {
      t.addEventListener('click', function () {
        show(k);
        restartCycle();
      });
    });
    if (frame) {
      frame.addEventListener('click', function () {
        show(current + 1);
        restartCycle();
      });
    }
    var picker = document.querySelector('.picker');
    if (picker) {
      picker.addEventListener('pointerenter', function () { window.clearInterval(timer); });
      picker.addEventListener('pointerleave', restartCycle);
      picker.addEventListener('focusin', function () { window.clearInterval(timer); });
      picker.addEventListener('focusout', restartCycle);
    }
    restartCycle();
  }

  /* ---------- hero disc: the shutter opens on load (it is above the fold).
     It must NOT be a scroll reveal: a clip-path of inset(0 0 100% 0) gives
     the element a zero-area visible region, so an IntersectionObserver
     never reports it intersecting and the shutter would never open. ---------- */
  var disc = document.querySelector('.hero-disc');
  if (disc) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { disc.classList.add('is-in'); });
    });
  }

  /* ---------- section reveals (once, in reading order) ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      io.observe(el);
    });
  }
})();
