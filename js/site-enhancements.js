/* Kayole Digital Hub — lightweight visual interactions */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal sections/cards as they enter the viewport.
  const revealItems = document.querySelectorAll('.reveal-item');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -30px 0px' });
    revealItems.forEach((item) => observer.observe(item));
  }

  // Count impact figures once, when the impact section becomes visible.
  const counters = document.querySelectorAll('.stat-number[data-count]');
  if (counters.length) {
    const runCounters = () => {
      counters.forEach((counter) => {
        if (counter.dataset.counted === 'true') return;
        counter.dataset.counted = 'true';
        const target = Number(counter.dataset.count || 0);
        const suffix = counter.dataset.suffix || '';
        if (reduceMotion) {
          counter.textContent = target + suffix;
          return;
        }
        const duration = 1100;
        const start = performance.now();
        const tick = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          counter.textContent = Math.round(target * eased) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    };

    if ('IntersectionObserver' in window && !reduceMotion) {
      const counterObserver = new IntersectionObserver((entries, obs) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          runCounters();
          obs.disconnect();
        }
      }, { threshold: 0.3 });
      const impact = document.querySelector('.impact');
      if (impact) counterObserver.observe(impact);
    } else {
      runCounters();
    }
  }
})();

// About Hub feature carousel: rotates the four feature cards while allowing manual selection.
(function () {
  'use strict';
  const rail = document.querySelector('[data-about-rotation]');
  if (!rail) return;
  const cards = Array.from(rail.querySelectorAll('.about-feature'));
  if (cards.length < 2) return;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let timer = null;
  const interval = 5000;

  function activate(index, restartTimer = true) {
    current = (index + cards.length) % cards.length;
    cards.forEach((card, i) => {
      card.classList.toggle('is-active', i === current);
      card.setAttribute('aria-pressed', i === current ? 'true' : 'false');
    });
    if (restartTimer && !reduceMotion) startTimer();
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => activate(current + 1, false), interval);
  }

  cards.forEach((card, index) => {
    card.addEventListener('click', () => activate(index));
    card.addEventListener('mouseenter', () => clearInterval(timer));
    card.addEventListener('mouseleave', () => { if (!reduceMotion) startTimer(); });
  });

  activate(0, false);
  if (!reduceMotion) startTimer();
})();

// Make sure the local Hub video resumes after a temporary browser interruption.
(function () {
  const video = document.querySelector('.hub-video');
  if (!video) return;
  const attemptPlay = () => video.play().catch(() => {});
  video.addEventListener('pause', () => {
    if (!video.ended && video.autoplay) attemptPlay();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) attemptPlay();
  });
})();
