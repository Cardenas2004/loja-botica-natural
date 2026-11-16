// @ts-check
/**
 * Bootstrap e Roteador por Hash do Painel Administrativo — Botica Natural (`js/admin/main.js`).
 */

import {
  state,
  setState,
  applyThemeToDocument,
  toggleTheme,
  toggleSidebarCollapsed,
  clearAllProductDrafts,
} from './state.js';

import { supabase } from '../supabaseClient.js';
import {
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_IDLE_WARNING_BEFORE_MS,
  createIdleSessionGuard,
} from './sessionTimeout.js';

import {
  el,
  createIcon,
  showToast,
  confirmAction,
  setButtonLoading,
} from './ui.js';

import { fetchAllAdminData } from './api.js';
import { loginAdmin, logoutAdmin, initAuthLifecycle } from './auth.js';

import { renderDashboardView } from './views/dashboard.js';
import { renderProductsView } from './views/products.js';
import { renderProductFormView } from './views/productForm.js';
import { renderCategoriesView } from './views/categories.js';
import { renderBannersView } from './views/banners.js';
import { renderCompoundsView } from './views/compounds.js';
import { renderWhatsAppView } from './views/whatsapp.js';

/** @type {(() => void) | null} */
let activeViewCleanup = null;
let lastConfirmedHash = window.location.hash || '#/';
let isRevertingHash = false;

/**
 * Interpreta o hash atual da URL e retorna a definição da rota.
 * @param {string} rawHash
 */
function parseHashRoute(rawHash) {
  const clean = String(rawHash || '#/').replace(/^#/, '').trim() || '/';
  if (clean === '/' || clean === '/dashboard') {
    return { view: 'dashboard', param: null, title: 'Visão Geral', parentLabel: null };
  }
  if (clean === '/produtos') {
    return { view: 'products', param: null, title: 'Produtos', parentLabel: null };
  }
  if (clean === '/produtos/novo') {
    return {
      view: 'product-form',
      param: null,
      title: 'Novo Produto',
      parentLabel: { label: 'Produtos', hash: '#/produtos' },
    };
  }
  if (clean.startsWith('/produtos/')) {
    const id = decodeURIComponent(clean.slice('/produtos/'.length).trim());
    return {
      view: 'product-form',
      param: id || null,
      title: 'Editar Produto',
      parentLabel: { label: 'Produtos', hash: '#/produtos' },
    };
  }
  if (clean === '/banners') {
    return { view: 'banners', param: null, title: 'Banners do Carrossel', parentLabel: null };
  }
  if (clean === '/compostos') {
    return { view: 'compounds', param: null, title: 'Vitrine de Compostos', parentLabel: null };
  }
  if (clean === '/categorias') {
    return { view: 'categories', param: null, title: 'Categorias', parentLabel: null };
  }
  if (clean === '/whatsapp') {
    return { view: 'whatsapp', param: null, title: 'Mensagens de WhatsApp', parentLabel: null };
  }
  return { view: 'dashboard', param: null, title: 'Visão Geral', parentLabel: null };
}

/**
 * Navega programaticamente para um hash respeitando a proteção de formulário sujo.
 * @param {string} targetHash
 */
export async function navigateToHash(targetHash) {
  const normalized = targetHash.startsWith('#') ? targetHash : `#${targetHash}`;
  if (window.location.hash === normalized) {
    await renderCurrentRoute();
    return;
  }
  window.location.hash = normalized;
}

/**
 * Atualiza o breadcrumb, o título da página e o item ativo da sidebar.
 * @param {ReturnType<typeof parseHashRoute>} routeInfo
 */
function updateShellNavigationUI(routeInfo) {
  const pageTitleEl = document.getElementById('admin-page-title');
  const breadcrumbEl = document.getElementById('admin-breadcrumb');

  if (pageTitleEl) {
    pageTitleEl.textContent = routeInfo.title;
  }

  document.title = `${routeInfo.title} | Admin Botica Natural`;

  if (breadcrumbEl) {
    const items = [
      el('a', { href: '#/', className: 'breadcrumb-link', textContent: 'Painel' }),
    ];
    if (routeInfo.parentLabel) {
      items.push(
        el('span', { className: 'breadcrumb-sep', 'aria-hidden': 'true', textContent: '/' }),
        el('a', {
          href: routeInfo.parentLabel.hash,
          className: 'breadcrumb-link',
          textContent: routeInfo.parentLabel.label,
        })
      );
    }
    items.push(
      el('span', { className: 'breadcrumb-sep', 'aria-hidden': 'true', textContent: '/' }),
      el('span', {
        className: 'breadcrumb-current',
        'aria-current': 'page',
        textContent: routeInfo.title,
      })
    );
    breadcrumbEl.replaceChildren(...items);
  }

  // Marca link ativo na sidebar
  const navLinks = document.querySelectorAll('.sidebar-nav__link');
  const activeKey =
    routeInfo.view === 'product-form' ? 'products' : routeInfo.view;

  navLinks.forEach((link) => {
    const linkView = link.getAttribute('data-view');
    const isCurrent = linkView === activeKey;
    link.classList.toggle('is-active', isCurrent);
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/**
 * Renderiza a view correspondente ao hash atual dentro de `#admin-view-outlet`.
 */
async function renderCurrentRoute() {
  if (!state.session) return;

  const outlet = document.getElementById('admin-view-outlet');
  if (!outlet) return;

  if (activeViewCleanup) {
    try {
      activeViewCleanup();
    } catch {
      // Ignora erro de cleanup
    }
    activeViewCleanup = null;
  }

  const routeInfo = parseHashRoute(window.location.hash);
  setState({ route: { view: routeInfo.view, param: routeInfo.param } });
  lastConfirmedHash = window.location.hash || '#/';

  updateShellNavigationUI(routeInfo);
  closeMobileDrawer();

  const routerApi = { navigate: navigateToHash };

  if (routeInfo.view === 'dashboard') {
    renderDashboardView(outlet, routerApi);
  } else if (routeInfo.view === 'products') {
    renderProductsView(outlet, routerApi);
  } else if (routeInfo.view === 'product-form') {
    activeViewCleanup = await renderProductFormView(outlet, {
      productId: routeInfo.param,
      navigate: navigateToHash,
    });
  } else if (routeInfo.view === 'categories') {
    renderCategoriesView(outlet);
  } else if (routeInfo.view === 'banners') {
    renderBannersView(outlet);
  } else if (routeInfo.view === 'compounds') {
    activeViewCleanup = renderCompoundsView(outlet);
  } else if (routeInfo.view === 'whatsapp') {
    renderWhatsAppView(outlet);
  }
}

/**
 * Abre ou fecha o drawer de navegação no mobile/tablet com foco controlado.
 */
function openMobileDrawer() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const openBtn = document.getElementById('btn-open-mobile-nav');
  if (!sidebar || !backdrop) return;

  setState({ mobileNavOpen: true });
  sidebar.classList.add('is-mobile-open');
  backdrop.hidden = false;
  openBtn?.setAttribute('aria-expanded', 'true');

  const firstLink = /** @type {HTMLElement | null} */ (
    sidebar.querySelector('a, button')
  );
  firstLink?.focus();
}

function closeMobileDrawer() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const openBtn = document.getElementById('btn-open-mobile-nav');
  if (!sidebar || !backdrop) return;

  setState({ mobileNavOpen: false });
  sidebar.classList.remove('is-mobile-open');
  backdrop.hidden = true;
  openBtn?.setAttribute('aria-expanded', 'false');
}

/**
 * Sincroniza o botão de tema e o estado de colapso da sidebar no DOM.
 */
function syncShellPreferencesUI() {
  applyThemeToDocument(state.theme);

  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    const isDark = state.theme === 'dark';
    themeBtn.setAttribute(
      'aria-label',
      isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'
    );
    themeBtn.setAttribute(
      'title',
      isDark ? 'Tema claro' : 'Tema escuro'
    );
    themeBtn.replaceChildren(
      createIcon(isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon')
    );
  }

  const shellEl = document.getElementById('dashboard-view');
  const collapseBtn = document.getElementById('btn-collapse-sidebar');
  if (shellEl) {
    shellEl.classList.toggle('is-sidebar-collapsed', state.sidebarCollapsed);
  }
  if (collapseBtn) {
    collapseBtn.setAttribute('aria-expanded', state.sidebarCollapsed ? 'false' : 'true');
    collapseBtn.setAttribute(
      'title',
      state.sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'
    );
  }
}

/**
 * Exibe uma mensagem de erro dentro de `#login-feedback`.
 * @param {string | null} message
 */
function setLoginFeedback(message) {
  const box = document.getElementById('login-feedback');
  if (!box) return;
  if (message) {
    box.textContent = message;
    box.hidden = false;
  } else {
    box.textContent = '';
    box.hidden = true;
  }
}

/**
 * Registra os eventos globais do shell administrativo.
 */
function bindShellEvents() {
  const loginForm = /** @type {HTMLFormElement | null} */ (document.getElementById('login-form'));
  const emailInput = /** @type {HTMLInputElement | null} */ (document.getElementById('email'));
  const passwordInput = /** @type {HTMLInputElement | null} */ (document.getElementById('password'));
  const btnLogin = /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-login'));
  const btnLogout = document.getElementById('btn-logout');
  const btnTheme = document.getElementById('btn-toggle-theme');
  const btnCollapse = document.getElementById('btn-collapse-sidebar');
  const btnOpenMobile = document.getElementById('btn-open-mobile-nav');
  const btnCloseMobile = document.getElementById('btn-close-mobile-nav');
  const backdrop = document.getElementById('sidebar-backdrop');
  const globalSearchInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('admin-global-search')
  );

  // Submit de Login
  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginFeedback(null);

    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';

    setButtonLoading(
      btnLogin,
      true,
      'Autenticando...',
      'Entrar no Painel',
      'fa-solid fa-right-to-bracket'
    );

    try {
      const result = await loginAdmin(email, password);
      if (!result.ok) {
        setLoginFeedback(result.errorMessage || 'Falha na autenticação.');
        return;
      }
      showToast('Bem-vindo ao Painel Administrativo!', 'success');
    } finally {
      if (passwordInput) passwordInput.value = '';
      setButtonLoading(
        btnLogin,
        false,
        'Autenticando...',
        'Entrar no Painel',
        'fa-solid fa-right-to-bracket'
      );
    }
  });

  // Logout
  btnLogout?.addEventListener('click', async () => {
    if (state.isFormDirty) {
      const discard = await confirmAction({
        title: 'Alterações não salvas',
        message: 'Há alterações não salvas no formulário. Deseja realmente sair do painel?',
        confirmLabel: 'Sair mesmo assim',
      });
      if (!discard) return;
    }
    await logoutAdmin();
    showToast('Sessão encerrada com segurança.', 'info');
  });

  // Alternador de Tema Claro / Escuro
  btnTheme?.addEventListener('click', () => {
    toggleTheme();
    syncShellPreferencesUI();
  });

  // Colapsar sidebar no desktop
  btnCollapse?.addEventListener('click', () => {
    toggleSidebarCollapsed();
    syncShellPreferencesUI();
  });

  // Mobile drawer
  btnOpenMobile?.addEventListener('click', openMobileDrawer);
  btnCloseMobile?.addEventListener('click', closeMobileDrawer);
  backdrop?.addEventListener('click', closeMobileDrawer);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.mobileNavOpen) {
      closeMobileDrawer();
    }
  });

  // Busca global na Top Bar
  globalSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      state.productFilters.search = globalSearchInput.value.trim();
      state.productFilters.page = 1;
      navigateToHash('#/produtos');
    }
  });

  // Guardião de navegação por Hash (protege contra perda de dados em formulário sujo)
  window.addEventListener('hashchange', async () => {
    if (isRevertingHash) {
      isRevertingHash = false;
      return;
    }

    if (state.isFormDirty) {
      const targetHash = window.location.hash;
      const confirmed = await confirmAction({
        title: 'Alterações não salvas',
        message:
          'Você fez alterações neste produto que ainda não foram salvas. Deseja descartar as alterações e sair desta página?',
        confirmLabel: 'Descartar alterações',
      });

      if (!confirmed) {
        isRevertingHash = true;
        window.location.hash = lastConfirmedHash;
        return;
      }

      setState({ isFormDirty: false });
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }

    await renderCurrentRoute();
  });

  // Guardião nativo `beforeunload` ao fechar aba com formulário sujo
  window.addEventListener('beforeunload', (event) => {
    if (state.isFormDirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/**
 * Inicializa o aplicativo administrativo completo.
 */
export async function initAdminApp() {
  syncShellPreferencesUI();
  bindShellEvents();

  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const userEmailEl = document.getElementById('admin-user-email');

  const cleanupActiveView = () => {
    if (activeViewCleanup) {
      try {
        activeViewCleanup();
      } catch {
        // Ignora
      }
      activeViewCleanup = null;
    }
  };

  const idleGuard = createIdleSessionGuard({
    timeoutMs: ADMIN_IDLE_TIMEOUT_MS,
    warningBeforeMs: ADMIN_IDLE_WARNING_BEFORE_MS,
    onExtend: async () => {
      if (supabase?.auth && typeof supabase.auth.refreshSession === 'function') {
        await supabase.auth.refreshSession();
      }
    },
    onExpire: async () => {
      cleanupActiveView();
      await logoutAdmin();
      setLoginFeedback('Sessão encerrada por inatividade. Faça login novamente.');
    },
    onLogoutNow: async () => {
      cleanupActiveView();
      await logoutAdmin();
      setLoginFeedback('Sessão encerrada com segurança.');
    },
  });

  await initAuthLifecycle({
    onAuthenticated: async (session) => {
      setLoginFeedback(null);
      if (loginView) loginView.hidden = true;
      if (dashboardView) dashboardView.hidden = false;
      if (userEmailEl) {
        userEmailEl.textContent = session.user?.email || 'Administrador';
      }

      idleGuard.start();
      await fetchAllAdminData({ force: true });
      await renderCurrentRoute();
    },
    onUnauthenticated: (reason) => {
      idleGuard.stop();
      cleanupActiveView();
      clearAllProductDrafts();
      if (dashboardView) dashboardView.hidden = true;
      if (loginView) loginView.hidden = false;
      if (userEmailEl) userEmailEl.textContent = '';
      if (reason) setLoginFeedback(reason);
    },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
  initAdminApp();
}

