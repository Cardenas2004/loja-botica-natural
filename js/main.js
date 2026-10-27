/**
 * ============================================================================
 * Botica Natural — Core Application Controller (Landing Page, Catálogo & PDP)
 * ============================================================================
 * Arquitetura: Clean Code · SOLID · Progressive Enhancement · AppSec Hardened
 * Segurança: Zero innerHTML · Sanitização de URLs/Hashes · Event Delegation
 * Performance: Observers passivos · Índices pré-computados · Economia de CPU
 */
(() => {
  'use strict';

  /* ==========================================================================
     CONFIG — Configuração central imutável da aplicação
     ========================================================================== */
  const CONFIG = Object.freeze({
    whatsappNumber: '555197731564',
    defaultMessage: 'Olá! Gostaria de fazer um orçamento na Botica Natural.',
    cookieKey: 'bn_lgpd_consent',
    autoplayMs: 4500,
    promoAutoplayMs: 4500,
    allowedWhatsAppHosts: Object.freeze(['wa.me', 'api.whatsapp.com']),
  });

  /**
   * Seleciona um único elemento no contexto informado.
   * @param {string} sel
   * @param {ParentNode} [ctx=document]
   * @returns {HTMLElement | null}
   */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  /**
   * Seleciona múltiplos elementos como Array no contexto informado.
   * @param {string} sel
   * @param {ParentNode} [ctx=document]
   * @returns {HTMLElement[]}
   */
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = reducedMotionMQ.matches;
  reducedMotionMQ.addEventListener('change', (e) => {
    prefersReducedMotion = e.matches;
  });

  const desktopMQ = window.matchMedia('(min-width: 992px)');

  /**
   * Normaliza texto removendo diacríticos (acentos) e convertendo para minúsculas.
   * @param {unknown} str
   * @returns {string}
   */
  const normalizeSearchText = (str) => {
    if (typeof str !== 'string') return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  /**
   * Sanitiza identificadores de categoria ou âncoras de URL contra injeção.
   * @param {unknown} rawValue
   * @returns {string}
   */
  const sanitizeSlug = (rawValue) => {
    if (typeof rawValue !== 'string') return '';
    const cleaned = rawValue.trim().toLowerCase();
    return /^[a-z0-9_-]{1,64}$/.test(cleaned) ? cleaned : '';
  };

  /**
   * Constrói uma URL segura do WhatsApp a partir de número e mensagem.
   * @param {string} message
   * @returns {string}
   */
  const buildSafeWhatsAppUrl = (message) => {
    const safeMsg = typeof message === 'string' && message.trim().length > 0
      ? message.trim().slice(0, 500)
      : CONFIG.defaultMessage;
    return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(safeMsg)}`;
  };

  /**
   * Valida e higieniza o href de um link de WhatsApp contra protocolos inseguros
   * ou números malformados (ex.: DDI 55 duplicado).
   * @param {HTMLAnchorElement} link
   */
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

      // Corrige eventual DDI duplicado (555551...) e remove parâmetros de rastreamento externos (fbclid)
      if (parsed.hostname === 'api.whatsapp.com') {
        const textParam = parsed.searchParams.get('text') || CONFIG.defaultMessage;
        link.href = buildSafeWhatsAppUrl(textParam);
      }
    } catch {
      link.href = buildSafeWhatsAppUrl(CONFIG.defaultMessage);
    }
  };

  /* ==========================================================================
     1. WHATSAPP — Blindagem de links + Event Delegation para elementos dinâmicos
     ========================================================================== */
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
        /* Isolamento de falhas de scripts de analytics de terceiros */
      }
    });
  };

  /* ==========================================================================
     2. SCROLL — Header e barra de progresso (listener passivo único com rAF)
     ========================================================================== */
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

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  };

  /* ==========================================================================
     3. MENU MOBILE — Acessível (WAI-ARIA, Esc, Focus Trap, Backdrop)
     ========================================================================== */
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

  /* ==========================================================================
     4. LINK ATIVO NO MENU — IntersectionObserver restrito a âncoras da página
     ========================================================================== */
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

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        anchorLinks.forEach((link) => {
          const active = link.hash === `#${entry.target.id}`;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach((s) => observer.observe(s));
  };

  /* ==========================================================================
     5. CTAs FLUTUANTES — Visibilidade inteligente sem sobrepor CTAs principais
     ========================================================================== */
  const initFloatingCtas = () => {
    const floats = $$('.mobile-cta, .wa-float');
    if (!floats.length) return;

    const heroCta = $('.hero__actions') || $('.catalog-search-wrap') || $('.pdp-purchase-card__actions');
    const finalCta = $('.cta-final') || $('.catalog-custom-banner');

    if (heroCta && 'IntersectionObserver' in window) {
      const state = { hero: true, final: false };
      const render = () => {
        const show = !state.hero && !state.final;
        floats.forEach((el) => el.classList.toggle('is-visible', show));
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.target === heroCta) state.hero = entry.isIntersecting;
          if (entry.target === finalCta) state.final = entry.isIntersecting;
        });
        render();
      }, { threshold: 0 });

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

  /* ==========================================================================
     6. SCROLL REVEAL — Com stagger automático em grids
     ========================================================================== */
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

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        el.addEventListener('transitionend', () => el.style.removeProperty('--reveal-delay'), { once: true });
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach((el) => observer.observe(el));
  };

  /* ==========================================================================
     7. CARROSSEL DE DEPOIMENTOS (Vanilla JS) — Máquina de Estados + Ciclo Infinito
     Auto-slide com single-timer guard (clearInterval), reset inteligente no clique,
     pause em hover/touch/foco, Page Visibility API e IntersectionObserver.
     ========================================================================== */
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
      // Com ciclo infinito, as setas permanecem sempre habilitadas quando há mais de 1 página
      if (prev) prev.disabled = totalPages <= 1;
      if (next) next.disabled = totalPages <= 1;
    };

    const goToSlide = (targetIndex) => {
      if (totalPages <= 0) return;
      // Máquina de estados circular: garante ciclo infinito (0 -> 1 -> ... -> totalPages-1 -> 0)
      currentIndex = ((targetIndex % totalPages) + totalPages) % totalPages;
      const targetSlide = slides[currentIndex];
      if (!targetSlide) return;

      track.scrollTo({
        left: targetSlide.offsetLeft - slides[0].offsetLeft,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
      syncIndicators();
    };

    const nextSlide = () => {
      goToSlide((currentIndex + 1) % totalPages);
    };

    const prevSlide = () => {
      goToSlide((currentIndex - 1 + totalPages) % totalPages);
    };

    // Single-Timer Guard: garante que NUNCA existam múltiplos setInterval simultâneos
    const clearAutoplayTimer = () => {
      if (autoplayTimerId !== null) {
        window.clearInterval(autoplayTimerId);
        autoplayTimerId = null;
      }
    };

    const canRunAutoplay = () => (
      !prefersReducedMotion &&
      !document.hidden &&
      isInViewport &&
      !isHoveredOrTouched &&
      !isFocused &&
      totalPages > 1
    );

    const startAutoplayTimer = () => {
      clearAutoplayTimer();
      if (!canRunAutoplay()) return;
      autoplayTimerId = window.setInterval(nextSlide, CONFIG.autoplayMs);
    };

    // Reset Inteligente: reinicia a contagem regressiva do zero após interação manual
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

    // Controles manuais com reset imediato do cronômetro
    prev?.addEventListener('click', () => {
      prevSlide();
      resetAutoplayTimer();
    });

    next?.addEventListener('click', () => {
      nextSlide();
      resetAutoplayTimer();
    });

    // Sincroniza o indicador ativo durante o scroll manual / swipe nativo
    let scrollRaf = null;
    track.addEventListener('scroll', () => {
      if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        const calculated = Math.round(track.scrollLeft / getStepWidth());
        currentIndex = Math.max(0, Math.min(calculated, totalPages - 1));
        syncIndicators();
      });
    }, { passive: true });

    // Pause on Hover (Desktop) e Touch (Mobile) com retomada suave
    root.addEventListener('mouseenter', () => {
      isHoveredOrTouched = true;
      clearAutoplayTimer();
    });

    root.addEventListener('mouseleave', () => {
      isHoveredOrTouched = false;
      startAutoplayTimer();
    });

    root.addEventListener('touchstart', () => {
      isHoveredOrTouched = true;
      clearAutoplayTimer();
    }, { passive: true });

    root.addEventListener('touchend', () => {
      isHoveredOrTouched = false;
      resetAutoplayTimer();
    }, { passive: true });

    root.addEventListener('touchcancel', () => {
      isHoveredOrTouched = false;
      resetAutoplayTimer();
    }, { passive: true });

    // Acessibilidade por teclado (setas + pausa em foco)
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

    // IntersectionObserver: roda apenas quando visível na tela
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        isInViewport = Boolean(entry?.isIntersecting);
        if (isInViewport) startAutoplayTimer();
        else clearAutoplayTimer();
      }, { threshold: 0.35 }).observe(root);
    }

    // Page Visibility API: pausa quando a aba fica em segundo plano
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearAutoplayTimer();
      else startAutoplayTimer();
    });

    // Reage a mudanças na preferência prefers-reduced-motion em tempo real
    reducedMotionMQ.addEventListener('change', () => {
      if (prefersReducedMotion) clearAutoplayTimer();
      else startAutoplayTimer();
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderDots();
        resetAutoplayTimer();
      }, 150);
    }, { passive: true });

    renderDots();
    startAutoplayTimer();
  };

  /* ==========================================================================
     7b. CARROSSEL HERO BANNER FULL-BLEED (.promo__carousel)
     Integração Híbrida: Swiper.js 11 (loop infinito + autoplay) + Controlador
     Determinístico de Ciclo de Vida de Timer + Fallback Vanilla JS caso offline.
     ========================================================================== */
  const initPromoCarousel = () => {
    const el = $('.promo__carousel');
    if (!el) return;

    const wrapper = $('.swiper-wrapper', el);
    const slides = $$('.promo__slide', el);
    const paginationEl = $('.swiper-pagination', el);
    const prevBtn = $('.swiper-button-prev', el);
    const nextBtn = $('.swiper-button-next', el);

    if (!wrapper || slides.length < 2) return;

    // ------------------------------------------------------------------------
    // MODO 1: Biblioteca Swiper.js ativa (Configuração Sênior + Timer Guard)
    // ------------------------------------------------------------------------
    if (typeof window.Swiper === 'function') {
      let swiperInstance = null;
      let isHoveredOrTouched = false;
      let isFocused = false;
      let isInViewport = true;

      try {
        swiperInstance = new window.Swiper(el, {
          direction: 'horizontal',
          loop: true,
          grabCursor: true,
          speed: prefersReducedMotion ? 0 : 650,
          watchSlidesProgress: true,

          // Recalcula geometria automaticamente entre Mobile (1:1) e Desktop (1920:650)
          observer: true,
          observeParents: true,
          resizeObserver: true,

          // Full-bleed: 1 slide ocupando 100% da largura sem frestas
          slidesPerView: 1,
          spaceBetween: 0,

          // Configuração nativa de Autoplay do Swiper
          autoplay: prefersReducedMotion ? false : {
            delay: CONFIG.promoAutoplayMs,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
            waitForTransition: true,
          },

          keyboard: { enabled: true, onlyInViewport: true },

          pagination: {
            el: paginationEl,
            clickable: true,
          },

          navigation: {
            nextEl: nextBtn,
            prevEl: prevBtn,
          },

          a11y: {
            prevSlideMessage: 'Banner anterior',
            nextSlideMessage: 'Próximo banner',
            paginationBulletMessage: 'Ir para o banner {{index}}',
            slideLabelMessage: '{{index}} de {{slidesLength}}',
          },
        });
      } catch {
        swiperInstance = null;
      }

      if (swiperInstance) {
        const canAutoplay = () => (
          !prefersReducedMotion &&
          !document.hidden &&
          isInViewport &&
          !isHoveredOrTouched &&
          !isFocused
        );

        const safeStopAutoplay = () => {
          if (swiperInstance?.autoplay?.running) {
            swiperInstance.autoplay.stop();
          }
        };

        const safeStartAutoplay = () => {
          if (!swiperInstance?.autoplay) return;
          safeStopAutoplay();
          if (canAutoplay()) {
            swiperInstance.autoplay.start();
          }
        };

        // Reset inteligente ao clicar nas setas ou bullets de paginação
        const handleManualControlClick = () => {
          if (!swiperInstance?.autoplay) return;
          safeStopAutoplay();
          if (canAutoplay()) {
            swiperInstance.autoplay.start();
          }
        };

        prevBtn?.addEventListener('click', handleManualControlClick);
        nextBtn?.addEventListener('click', handleManualControlClick);
        paginationEl?.addEventListener('click', handleManualControlClick);

        // Pause on Hover (Desktop) & Touch (Mobile)
        el.addEventListener('mouseenter', () => {
          isHoveredOrTouched = true;
          safeStopAutoplay();
        });

        el.addEventListener('mouseleave', () => {
          isHoveredOrTouched = false;
          safeStartAutoplay();
        });

        el.addEventListener('touchstart', () => {
          isHoveredOrTouched = true;
          safeStopAutoplay();
        }, { passive: true });

        el.addEventListener('touchend', () => {
          isHoveredOrTouched = false;
          safeStartAutoplay();
        }, { passive: true });

        el.addEventListener('touchcancel', () => {
          isHoveredOrTouched = false;
          safeStartAutoplay();
        }, { passive: true });

        // Acessibilidade: pausa quando controles internos recebem foco via Tab
        el.addEventListener('focusin', () => {
          isFocused = true;
          safeStopAutoplay();
        });

        el.addEventListener('focusout', (e) => {
          if (!el.contains(e.relatedTarget)) {
            isFocused = false;
            safeStartAutoplay();
          }
        });

        // IntersectionObserver: pausa quando o usuário rola a página e o Hero sai da tela
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(([entry]) => {
            isInViewport = Boolean(entry?.isIntersecting);
            if (isInViewport) safeStartAutoplay();
            else safeStopAutoplay();
          }, { threshold: 0.15 }).observe(el);
        }

        // Page Visibility API: pausa quando a aba do navegador fica oculta
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) safeStopAutoplay();
          else safeStartAutoplay();
        });

        // Reage dinamicamente à preferência prefers-reduced-motion do SO
        reducedMotionMQ.addEventListener('change', () => {
          if (prefersReducedMotion) safeStopAutoplay();
          else safeStartAutoplay();
        });

        return;
      }
    }

    // ------------------------------------------------------------------------
    // MODO 2 (Fallback Resiliente Vanilla JS): Caso o CDN externo esteja offline
    // Máquina de estados: (currentIndex + 1) % totalSlides + GPU translate3d
    // ------------------------------------------------------------------------
    const totalSlides = slides.length;
    let currentIndex = 0;
    let fallbackTimerId = null;
    let isPaused = false;
    let isInView = true;

    wrapper.style.display = 'flex';
    wrapper.style.transition = prefersReducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)';

    slides.forEach((slide) => {
      slide.style.flex = '0 0 100%';
      slide.style.width = '100%';
    });

    const bullets = [];
    if (paginationEl) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < totalSlides; i++) {
        const bullet = document.createElement('button');
        bullet.type = 'button';
        bullet.className = `swiper-pagination-bullet${i === 0 ? ' swiper-pagination-bullet-active' : ''}`;
        bullet.setAttribute('aria-label', `Ir para o banner ${i + 1}`);
        bullet.addEventListener('click', () => {
          renderSlide(i);
          resetFallbackTimer();
        });
        bullets.push(bullet);
        frag.appendChild(bullet);
      }
      paginationEl.replaceChildren(frag);
    }

    const renderSlide = (nextIdx) => {
      currentIndex = ((nextIdx % totalSlides) + totalSlides) % totalSlides;
      wrapper.style.transition = prefersReducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)';
      wrapper.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;

      bullets.forEach((b, idx) => {
        const active = idx === currentIndex;
        b.classList.toggle('swiper-pagination-bullet-active', active);
        b.setAttribute('aria-current', String(active));
      });
    };

    const clearFallbackTimer = () => {
      if (fallbackTimerId !== null) {
        window.clearInterval(fallbackTimerId);
        fallbackTimerId = null;
      }
    };

    const startFallbackTimer = () => {
      clearFallbackTimer();
      if (prefersReducedMotion || document.hidden || isPaused || !isInView) return;
      fallbackTimerId = window.setInterval(() => {
        renderSlide((currentIndex + 1) % totalSlides);
      }, CONFIG.promoAutoplayMs);
    };

    const resetFallbackTimer = () => {
      clearFallbackTimer();
      startFallbackTimer();
    };

    prevBtn?.addEventListener('click', () => {
      renderSlide((currentIndex - 1 + totalSlides) % totalSlides);
      resetFallbackTimer();
    });

    nextBtn?.addEventListener('click', () => {
      renderSlide((currentIndex + 1) % totalSlides);
      resetFallbackTimer();
    });

    el.addEventListener('mouseenter', () => { isPaused = true; clearFallbackTimer(); });
    el.addEventListener('mouseleave', () => { isPaused = false; startFallbackTimer(); });
    el.addEventListener('touchstart', () => { isPaused = true; clearFallbackTimer(); }, { passive: true });
    el.addEventListener('touchend', () => { isPaused = false; resetFallbackTimer(); }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearFallbackTimer();
      else startFallbackTimer();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        isInView = Boolean(entry?.isIntersecting);
        if (isInView) startFallbackTimer();
        else clearFallbackTimer();
      }, { threshold: 0.15 }).observe(el);
    }

    renderSlide(0);
    startFallbackTimer();
  };

  /* ==========================================================================
     8. CONTADORES — Animação fluida com easing quartic
     ========================================================================== */
  const initCounters = () => {
    const counters = $$('[data-counter]');
    if (!counters.length || prefersReducedMotion || !('IntersectionObserver' in window)) return;

    const fmt = new Intl.NumberFormat('pt-BR');
    counters.forEach((el) => { el.textContent = '0'; });

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

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach((c) => observer.observe(c));
  };

  /* ==========================================================================
     9. FAQ — Acordeão exclusivo (apenas um item aberto por vez)
     ========================================================================== */
  const initFaq = () => {
    const items = $$('.faq__item');
    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => { if (other !== item) other.open = false; });
      });
    });
  };

  /* ==========================================================================
     10. COOKIE CONSENT (LGPD) — Persistência resiliente a modo privado
     ========================================================================== */
  const initCookieConsent = () => {
    const banner = $('.cookie');
    if (!banner) return;

    let accepted = false;
    try {
      accepted = localStorage.getItem(CONFIG.cookieKey) === 'true';
    } catch {
      /* Storage bloqueado ou modo privado restrito */
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

  /* ==========================================================================
     11. MISC — Ano dinâmico no rodapé
     ========================================================================== */
  const initYear = () => {
    const currentYear = String(new Date().getFullYear());
    $$('[data-year]').forEach((el) => { el.textContent = currentYear; });
  };

  /* ==========================================================================
     12. CATÁLOGO INTERATIVO — Abas WAI-ARIA + Busca Normalizada Pré-Indexada
     ========================================================================== */
  const initCatalog = () => {
    const tabsContainer = $('[data-catalog-tabs]');
    const grid = $('[data-catalog-grid]');
    if (!grid || grid.hasAttribute('data-dynamic-catalog')) return;

    const cards = $$('.product-card', grid);
    const tabs = $$('.catalog-tab', tabsContainer || document);
    const searchInput = $('[data-catalog-search]');
    const clearBtn = $('.catalog-search-clear');
    const counterEl = $('[data-catalog-count]');
    const emptyState = $('[data-catalog-empty]');

    let currentCategory = 'todos';
    let searchQuery = '';

    // Pré-indexa os metadados dos cards uma única vez no boot (O(1) por card durante a digitação)
    const indexedCards = cards.map((card) => ({
      el: card,
      category: sanitizeSlug(card.dataset.category),
      searchableText: normalizeSearchText(`${card.dataset.search || ''} ${card.textContent || ''}`),
    }));

    // Atualiza contadores dinamicamente nas abas
    tabs.forEach((tab) => {
      const cat = sanitizeSlug(tab.dataset.category) || 'todos';
      const countEl = $('.catalog-tab__count', tab);
      if (countEl) {
        const count = cat === 'todos'
          ? indexedCards.length
          : indexedCards.filter((item) => item.category === cat).length;
        countEl.textContent = String(count);
      }
    });

    const syncTabAriaState = (activeCategory) => {
      tabs.forEach((tab) => {
        const isSelected = (sanitizeSlug(tab.dataset.category) || 'todos') === activeCategory;
        tab.classList.toggle('is-active', isSelected);
        tab.setAttribute('aria-selected', String(isSelected));
        tab.setAttribute('tabindex', isSelected ? '0' : '-1');
      });
    };

    const filterProducts = () => {
      let visibleCount = 0;
      const normalizedQuery = normalizeSearchText(searchQuery);

      indexedCards.forEach(({ el, category, searchableText }) => {
        const matchesCat = currentCategory === 'todos' || category === currentCategory;
        const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);

        const isVisible = matchesCat && matchesSearch;
        el.style.display = isVisible ? '' : 'none';
        if (isVisible) {
          visibleCount += 1;
          el.classList.add('is-visible');
        }
      });

      if (counterEl) {
        counterEl.textContent = `Exibindo ${visibleCount} ${visibleCount === 1 ? 'fórmula' : 'fórmulas'}`;
      }

      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
      }
    };

    const selectCategory = (categorySlug, { updateHistory = true, focusTab = false } = {}) => {
      const safeCat = sanitizeSlug(categorySlug) || 'todos';
      currentCategory = safeCat;
      syncTabAriaState(safeCat);

      if (focusTab) {
        const activeTab = tabs.find((t) => (sanitizeSlug(t.dataset.category) || 'todos') === safeCat);
        activeTab?.focus();
      }

      if (updateHistory && typeof history.replaceState === 'function') {
        try {
          history.replaceState(null, '', safeCat === 'todos' ? '#todos' : `#${safeCat}`);
        } catch {
          /* Ambientes restritos de histórico */
        }
      }

      filterProducts();
    };

    // Cliques nas abas
    tabsContainer?.addEventListener('click', (e) => {
      const tab = e.target instanceof Element ? e.target.closest('.catalog-tab') : null;
      if (!tab) return;
      selectCategory(tab.dataset.category || 'todos');
    });

    // Navegação por teclado nas abas (WAI-ARIA Tabs Pattern)
    tabsContainer?.addEventListener('keydown', (e) => {
      if (!tabs.length) return;
      const currentIndex = tabs.findIndex((t) => (sanitizeSlug(t.dataset.category) || 'todos') === currentCategory);
      if (currentIndex < 0) return;

      let nextIndex = null;
      if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') nextIndex = 0;
      if (e.key === 'End') nextIndex = tabs.length - 1;

      if (nextIndex !== null) {
        e.preventDefault();
        selectCategory(tabs[nextIndex].dataset.category || 'todos', { focusTab: true });
      }
    });

    // Busca com debounce leve
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
      searchQuery = String(e.target.value || '').slice(0, 120);
      clearBtn?.classList.toggle('is-visible', searchQuery.length > 0);

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(filterProducts, 80);
    });

    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchQuery = '';
      clearBtn?.classList.remove('is-visible');
      searchInput?.focus();
      filterProducts();
    });

    // Hash navigation inicial sanitizada (ex: produtos.html#dermocosmeticos)
    try {
      const rawHash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      const initialCategory = sanitizeSlug(rawHash);
      if (initialCategory) {
        const matchingTab = tabs.find((t) => sanitizeSlug(t.dataset.category) === initialCategory);
        if (matchingTab) {
          selectCategory(initialCategory, { updateHistory: false });
          return;
        }
      }
    } catch {
      /* Ignora URIError em hashes malformados */
    }

    selectCategory('todos', { updateHistory: false });
  };

  /* ==========================================================================
     INIT
     ========================================================================== */
  const init = () => {
    initWhatsApp();
    initScrollEffects();
    initMobileMenu();
    initActiveNav();
    initFloatingCtas();
    initReveal();
    initCarousel();
    initPromoCarousel();
    initCounters();
    initFaq();
    initCookieConsent();
    initYear();
    initCatalog();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
