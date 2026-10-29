/**
 * ============================================================================
 * Botica Natural — Core UI & Interaction Controller (js/main.js)
 * ============================================================================
 * Responsabilidade: Header, Scroll Progress, Menu Mobile, Depoimentos,
 * Contadores, FAQ, LGPD e Blindagem de Links do WhatsApp.
 * (Carrossel Hero e Catálogo de Produtos são controlados 100% por js/app.js via Supabase)
 */
(() => {
  'use strict';

  const CONFIG = Object.freeze({
    whatsappNumber: '555197731564',
    defaultMessage: 'Olá! Gostaria de fazer um orçamento na Botica Natural.',
    cookieKey: 'bn_lgpd_consent',
    autoplayMs: 4500,
    allowedWhatsAppHosts: Object.freeze(['wa.me', 'api.whatsapp.com']),
  });

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = reducedMotionMQ.matches;
  reducedMotionMQ.addEventListener('change', (e) => {
    prefersReducedMotion = e.matches;
  });

  const desktopMQ = window.matchMedia('(min-width: 992px)');

  const sanitizeSlug = (rawValue) => {
    if (typeof rawValue !== 'string') return '';
    const cleaned = rawValue.trim().toLowerCase();
    return /^[a-z0-9_-]{1,64}$/.test(cleaned) ? cleaned : '';
  };

  const buildSafeWhatsAppUrl = (message) => {
    const safeMsg =
      typeof message === 'string' && message.trim().length > 0
        ? message.trim().slice(0, 500)
        : CONFIG.defaultMessage;
    return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(safeMsg)}`;
  };

  const hardenWhatsAppLink = (link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const customMsg = link.dataset.waMsg;
    if (customMsg) {
      link.href = buildSafeWhatsAppUrl(customMsg);
      return;
    }

    const rawHref = link.getAttribute('href') || '';
    try {
      const parsed = new URL(rawHref, window.location.origin);
      const isAllowedHost = CONFIG.allowedWhatsAppHosts.includes(parsed.hostname);

      if (parsed.protocol !== 'https:' || !isAllowedHost) {
        link.href = buildSafeWhatsAppUrl(CONFIG.defaultMessage);
        return;
      }

      if (parsed.hostname === 'api.whatsapp.com') {
        const textParam = parsed.searchParams.get('text') || CONFIG.defaultMessage;
        link.href = buildSafeWhatsAppUrl(textParam);
      }
    } catch {
      link.href = buildSafeWhatsAppUrl(CONFIG.defaultMessage);
    }
  };

  /* 1. WHATSAPP — Blindagem de links + Event Delegation */
  const initWhatsApp = () => {
    $$('a[data-wa]').forEach(hardenWhatsAppLink);

    document.addEventListener('click', (e) => {
      const link = e.target instanceof Element ? e.target.closest('a[data-wa]') : null;
      if (!link) return;

      hardenWhatsAppLink(link);

      const ctaLocation = sanitizeSlug(link.dataset.wa) || 'geral';
      const payload = { event: 'whatsapp_click', cta_location: ctaLocation };

      try {
        (window.dataLayer = window.dataLayer || []).push(payload);
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'whatsapp_click', { cta_location: ctaLocation });
        }
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'Contact');
        }
      } catch {
        /* Isolamento de falhas de analytics */
      }
    });
  };

  /* 2. SCROLL — Header e barra de progresso */
  const initScrollEffects = () => {
    const header = $('.header');
    const progress = $('.scroll-progress');
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      header?.classList.toggle('is-scrolled', y > 24);

      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.max(0, Math.min(y / max, 1)) : 0;
        progress.style.transform = `scaleX(${ratio})`;
      }
      ticking = false;
    };

    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );

    update();
  };

  /* 3. MENU MOBILE — Acessível (WAI-ARIA, Esc, Focus Trap, Backdrop) */
  const initMobileMenu = () => {
    const header = $('.header');
    const toggle = $('.nav-toggle');
    const nav = $('#menu');
    const backdrop = $('.nav-backdrop');
    if (!toggle || !nav) return;

    const focusables = () => $$('a[href], button:not([disabled])', nav);
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

    const setOpen = (open, { returnFocus = true } = {}) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      nav.classList.toggle('is-open', open);
      backdrop?.classList.toggle('is-visible', open);
      header?.classList.toggle('menu-is-open', open);
      document.body.classList.toggle('menu-open', open);

      if (open) {
        setTimeout(() => focusables()[0]?.focus({ preventScroll: true }), 50);
      } else if (returnFocus) {
        toggle.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    backdrop?.addEventListener('click', () => setOpen(false));

    nav.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('a') && isOpen()) {
        setOpen(false, { returnFocus: false });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;

      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (e.key === 'Tab') {
        const items = [toggle, ...focusables()];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });

    desktopMQ.addEventListener('change', (e) => {
      if (e.matches && isOpen()) setOpen(false, { returnFocus: false });
    });
  };

  /* 4. LINK ATIVO NO MENU */
  const initActiveNav = () => {
    const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';

    const anchorLinks = $$('.nav__link').filter((link) => {
      if (!link.hash || link.hash.length <= 1) return false;
      const linkPath = link.pathname.replace(/\/index\.html$/, '/') || '/';
      return linkPath === currentPath;
    });

    const sections = anchorLinks
      .map((link) => {
        const id = link.hash.slice(1);
        return id ? document.getElementById(id) : null;
      })
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          anchorLinks.forEach((link) => {
            const active = link.hash === `#${entry.target.id}`;
            link.classList.toggle('is-active', active);
            if (active) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );

    sections.forEach((s) => observer.observe(s));
  };

  /* 5. CTAs FLUTUANTES */
  const initFloatingCtas = () => {
    const floats = $$('.mobile-cta, .wa-float');
    if (!floats.length) return;

    const heroCta = $('.hero__actions') || $('.catalog-search-wrap') || $('#pdp-btn-buy');
    const finalCta = $('.cta-final') || $('.catalog-custom-banner');

    if (heroCta && 'IntersectionObserver' in window) {
      const state = { hero: true, final: false };
      const render = () => {
        const show = !state.hero && !state.final;
        floats.forEach((el) => el.classList.toggle('is-visible', show));
      };

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === heroCta) state.hero = entry.isIntersecting;
            if (entry.target === finalCta) state.final = entry.isIntersecting;
          });
          render();
        },
        { threshold: 0 }
      );

      observer.observe(heroCta);
      if (finalCta) observer.observe(finalCta);
    } else {
      const onScroll = () => {
        const show = window.scrollY > 300;
        floats.forEach((el) => el.classList.toggle('is-visible', show));
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  };

  /* 6. SCROLL REVEAL */
  const initReveal = () => {
    const items = $$('.reveal');
    if (!items.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    $$('[data-stagger]').forEach((group) => {
      [...group.children].forEach((child, i) => {
        child.style.setProperty('--reveal-delay', `${Math.min(i * 90, 360)}ms`);
      });
    });

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add('is-visible');
          el.addEventListener('transitionend', () => el.style.removeProperty('--reveal-delay'), {
            once: true,
          });
          obs.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    items.forEach((el) => observer.observe(el));
  };

  /* 7. CARROSSEL DE DEPOIMENTOS (Vanilla JS) */
  const initCarousel = () => {
    const root = $('[data-carousel]');
    if (!root) return;

    const track = $('.carousel__track', root);
    const slides = $$('.carousel__slide', root);
    const prev = $('[data-carousel-prev]', root);
    const next = $('[data-carousel-next]', root);
    const dotsWrap = $('.carousel__dots', root);
    if (!track || slides.length < 2) return;

    let totalPages = 1;
    let currentIndex = 0;
    let autoplayTimerId = null;
    let isHoveredOrTouched = false;
    let isFocused = false;
    let isInViewport = true;

    const getStepWidth = () => {
      const diff = slides[1].offsetLeft - slides[0].offsetLeft;
      return Math.max(1, diff || track.clientWidth || 1);
    };

    const getVisibleCount = () => Math.max(1, Math.round((track.clientWidth || 1) / getStepWidth()));

    const syncIndicators = () => {
      if (dotsWrap) {
        $$('.carousel__dot', dotsWrap).forEach((dot, idx) => {
          const isCurrent = idx === currentIndex;
          dot.setAttribute('aria-current', String(isCurrent));
          dot.classList.toggle('is-active', isCurrent);
        });
      }
      if (prev) prev.disabled = totalPages <= 1;
      if (next) next.disabled = totalPages <= 1;
    };

    const goToSlide = (targetIndex) => {
      if (totalPages <= 0) return;
      currentIndex = ((targetIndex % totalPages) + totalPages) % totalPages;
      const targetSlide = slides[currentIndex];
      if (!targetSlide) return;

      track.scrollTo({
        left: targetSlide.offsetLeft - slides[0].offsetLeft,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
      syncIndicators();
    };

    const nextSlide = () => goToSlide((currentIndex + 1) % totalPages);
    const prevSlide = () => goToSlide((currentIndex - 1 + totalPages) % totalPages);

    const clearAutoplayTimer = () => {
      if (autoplayTimerId !== null) {
        window.clearInterval(autoplayTimerId);
        autoplayTimerId = null;
      }
    };

    const canRunAutoplay = () =>
      !prefersReducedMotion &&
      !document.hidden &&
      isInViewport &&
      !isHoveredOrTouched &&
      !isFocused &&
      totalPages > 1;

    const startAutoplayTimer = () => {
      clearAutoplayTimer();
      if (!canRunAutoplay()) return;
      autoplayTimerId = window.setInterval(nextSlide, CONFIG.autoplayMs);
    };

    const resetAutoplayTimer = () => {
      clearAutoplayTimer();
      startAutoplayTimer();
    };

    const renderDots = () => {
      totalPages = Math.max(1, slides.length - getVisibleCount() + 1);
      if (currentIndex >= totalPages) {
        currentIndex = Math.max(0, totalPages - 1);
      }

      if (dotsWrap) {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < totalPages; i++) {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'carousel__dot';
          dot.setAttribute('aria-label', `Ir para o depoimento ${i + 1}`);
          dot.addEventListener('click', () => {
            goToSlide(i);
            resetAutoplayTimer();
          });
          fragment.appendChild(dot);
        }
        dotsWrap.replaceChildren(fragment);
        dotsWrap.hidden = totalPages <= 1;
      }
      syncIndicators();
    };

    prev?.addEventListener('click', () => {
      prevSlide();
      resetAutoplayTimer();
    });

    next?.addEventListener('click', () => {
      nextSlide();
      resetAutoplayTimer();
    });

    let scrollRaf = null;
    track.addEventListener(
      'scroll',
      () => {
        if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
        scrollRaf = requestAnimationFrame(() => {
          const calculated = Math.round(track.scrollLeft / getStepWidth());
          currentIndex = Math.max(0, Math.min(calculated, totalPages - 1));
          syncIndicators();
        });
      },
      { passive: true }
    );

    root.addEventListener('mouseenter', () => {
      isHoveredOrTouched = true;
      clearAutoplayTimer();
    });

    root.addEventListener('mouseleave', () => {
      isHoveredOrTouched = false;
      startAutoplayTimer();
    });

    root.addEventListener(
      'touchstart',
      () => {
        isHoveredOrTouched = true;
        clearAutoplayTimer();
      },
      { passive: true }
    );

    root.addEventListener(
      'touchend',
      () => {
        isHoveredOrTouched = false;
        resetAutoplayTimer();
      },
      { passive: true }
    );

    root.addEventListener(
      'touchcancel',
      () => {
        isHoveredOrTouched = false;
        resetAutoplayTimer();
      },
      { passive: true }
    );

    root.addEventListener('focusin', () => {
      isFocused = true;
      clearAutoplayTimer();
    });

    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget)) {
        isFocused = false;
        startAutoplayTimer();
      }
    });

    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
        resetAutoplayTimer();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
        resetAutoplayTimer();
      }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          isInViewport = Boolean(entry?.isIntersecting);
          if (isInViewport) startAutoplayTimer();
          else clearAutoplayTimer();
        },
        { threshold: 0.35 }
      ).observe(root);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearAutoplayTimer();
      else startAutoplayTimer();
    });

    reducedMotionMQ.addEventListener('change', () => {
      if (prefersReducedMotion) clearAutoplayTimer();
      else startAutoplayTimer();
    });

    let resizeTimer;
    window.addEventListener(
      'resize',
      () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          renderDots();
          resetAutoplayTimer();
        }, 150);
      },
      { passive: true }
    );

    renderDots();
    startAutoplayTimer();
  };

  /* 8. CONTADORES */
  const initCounters = () => {
    const counters = $$('[data-counter]');
    if (!counters.length || prefersReducedMotion || !('IntersectionObserver' in window)) return;

    const fmt = new Intl.NumberFormat('pt-BR');
    counters.forEach((el) => {
      el.textContent = '0';
    });

    const animate = (el) => {
      const target = Math.max(0, Number(el.dataset.counter) || 0);
      const duration = 1800;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt.format(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animate(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach((c) => observer.observe(c));
  };

  /* 9. FAQ — Acordeão exclusivo */
  const initFaq = () => {
    const items = $$('.faq__item');
    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });
  };

  /* 10. COOKIE CONSENT (LGPD) */
  const initCookieConsent = () => {
    const banner = $('.cookie');
    if (!banner) return;

    let accepted = false;
    try {
      accepted = localStorage.getItem(CONFIG.cookieKey) === 'true';
    } catch {
      /* Storage restrito */
    }
    if (accepted) return;

    const show = () => {
      banner.hidden = false;
      document.documentElement.classList.add('has-cookie');
    };

    setTimeout(show, 1500);

    $('[data-cookie-accept]', banner)?.addEventListener('click', () => {
      try {
        localStorage.setItem(CONFIG.cookieKey, 'true');
      } catch {
        /* ignore */
      }
      banner.hidden = true;
      document.documentElement.classList.remove('has-cookie');
    });
  };

  /* 11. ANO DINÂMICO NO RODAPÉ */
  const initYear = () => {
    const currentYear = String(new Date().getFullYear());
    $$('[data-year]').forEach((el) => {
      el.textContent = currentYear;
    });
  };

  const init = () => {
    initWhatsApp();
    initScrollEffects();
    initMobileMenu();
    initActiveNav();
    initFloatingCtas();
    initReveal();
    initCarousel();
    initCounters();
    initFaq();
    initCookieConsent();
    initYear();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();