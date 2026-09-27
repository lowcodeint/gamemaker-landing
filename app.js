// Fake door test logic. Three call-to-action variants, an offer poll after signup, and
// PostHog tracking. Works even if PostHog is not configured (variant falls back to local pick).
(function () {
  const cfg = window.GM_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const VARIANTS = {
    waitlist: { cta: 'Join the waitlist', title: 'Get first dibs', sub: "Game Maker is in development. Leave your email and you'll be first to know when the first batch ships. No spam, no payment.", submit: 'Join the waitlist' },
    reserve: { cta: 'Reserve mine, free', title: 'Reserve your Game Maker', sub: 'Reservations are free and cost nothing. Leave your email to hold a spot in the first batch.', submit: 'Reserve mine' },
    preorder: { cta: 'Pre-order for $99', title: 'Pre-order Game Maker', sub: 'Pre-orders open soon. Leave your email to lock in the $99 founder price.', submit: 'Pre-order for $99' },
  };
  const ANGLES = {
    maker: { h: "Kids don't just play games.<br><em>They make them.</em>" },
    screentime: { h: 'Screen time you can<br><em>feel good about.</em>' },
    earned: { h: 'Upgrades kids earn by learning.<br><em>Never by paying.</em>' },
  };

  // ---------- analytics ----------
  let ph = null;
  function track(event, props) {
    try { if (ph) ph.capture(event, props); } catch (e) { /* ignore */ }
    if (params.get('debug')) console.log('[gm]', event, props);
  }
  function loadPostHog(cb) {
    if (!cfg.posthogKey) return cb();
    const s = document.createElement('script');
    s.src = cfg.posthogHost.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
    s.onload = function () {
      window.posthog.init(cfg.posthogKey, { api_host: cfg.posthogHost, person_profiles: 'identified_only', capture_pageview: true, autocapture: true, loaded: function (p) { ph = p; cb(); } });
    };
    s.onerror = cb;
    document.head.appendChild(s);
  }

  // ---------- variant assignment ----------
  function pickVariant() {
    const forced = params.get('v');
    if (forced && VARIANTS[forced]) return forced;
    if (ph && cfg.ctaFlag) {
      const v = ph.getFeatureFlag(cfg.ctaFlag);
      if (v && VARIANTS[v]) return v;
    }
    let v = localStorage.getItem('gm_variant');
    if (!v || !VARIANTS[v]) {
      const keys = Object.keys(VARIANTS);
      v = keys[Math.floor(Math.random() * keys.length)];
      localStorage.setItem('gm_variant', v);
    }
    return v;
  }

  function apply(variant, angle) {
    const V = VARIANTS[variant];
    document.querySelectorAll('[data-cta]').forEach((el) => (el.textContent = V.cta));
    document.getElementById('form-title').textContent = V.title;
    document.getElementById('form-sub').textContent = V.sub;
    document.getElementById('submit-btn').textContent = V.submit;
    if (ANGLES[angle]) document.getElementById('headline').innerHTML = ANGLES[angle].h;
  }

  loadPostHog(function () {
    const variant = pickVariant();
    const angle = params.get('angle') || 'maker';
    apply(variant, angle);
    if (ph) ph.register({ gm_variant: variant, gm_angle: angle });
    track('gm_landing_view', { variant, angle });

    document.querySelectorAll('[data-cta]').forEach((el) => {
      el.addEventListener('click', function (e) {
        track('gm_cta_click', { variant, angle, location: el.classList.contains('nav-cta') ? 'nav' : 'body' });
        if (variant === 'preorder') {
          e.preventDefault();
          document.getElementById('preorder-modal').classList.remove('hidden');
          track('gm_preorder_wall_shown', { variant });
        }
      });
    });
    document.getElementById('modal-ok').addEventListener('click', function () {
      document.getElementById('preorder-modal').classList.add('hidden');
      track('gm_preorder_wall_accept', { variant });
      location.hash = '#reserve';
      document.getElementById('email').focus();
    });
    document.getElementById('modal-close').addEventListener('click', function () {
      document.getElementById('preorder-modal').classList.add('hidden');
      track('gm_preorder_wall_dismiss', { variant });
    });

    document.getElementById('signup').addEventListener('submit', function (e) {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email) return;
      try { if (ph) ph.identify(email, { email, gm_variant: variant, gm_angle: angle }); } catch (err) { /* ignore */ }
      track('gm_waitlist_signup', { variant, angle, email_domain: email.split('@')[1] || '' });
      document.getElementById('form-card').classList.add('hidden');
      document.getElementById('thanks-card').classList.remove('hidden');
    });

    document.querySelectorAll('.poll-btn').forEach((b) => {
      b.addEventListener('click', function () {
        track('gm_offer_poll', { choice: b.dataset.poll, variant, angle });
        document.querySelectorAll('.poll-btn').forEach((x) => (x.disabled = true));
        b.classList.add('primary');
        document.getElementById('poll-thanks').classList.remove('hidden');
      });
    });
  });
})();
