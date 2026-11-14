// @ts-check
/**
 * Gerenciador de estado reativo e preferências de UI do Painel Administrativo.
 */

const THEME_STORAGE_KEY = 'botica_admin_theme';
const SIDEBAR_STORAGE_KEY = 'botica_admin_sidebar_collapsed';

/**
 * @typedef {Object} AdminState
 * @property {any | null} session
 * @property {string} userEmail
 * @property {string} currentUserId
 * @property {{ view: string, param: string | null }} route
 * @property {'light' | 'dark'} theme
 * @property {boolean} sidebarCollapsed
 * @property {boolean} mobileNavOpen
 * @property {boolean} isLoadingData
 * @property {number} lastFetchedAt
 * @property {Array<any>} categories
 * @property {Array<any>} products
 * @property {Array<any>} carouselSlides
 * @property {Array<any>} compoundCards
 * @property {string | null} whatsappTemplate
 * @property {string} whatsappScope
 * @property {number} selectedSampleIndex
 * @property {{
 *   search: string,
 *   categoryId: string,
 *   status: string,
 *   bestseller: string,
 *   sort: string,
 *   page: number,
 *   pageSize: number
 * }} productFilters
 * @property {Set<string>} selectedProductIds
 * @property {boolean} isFormDirty
 */

/** @type {AdminState} */
export const state = {
  session: null,
  userEmail: '',
  currentUserId: '',
  route: { view: 'dashboard', param: null },
  theme: getInitialTheme(),
  sidebarCollapsed: getInitialSidebarCollapsed(),
  mobileNavOpen: false,
  isLoadingData: false,
  lastFetchedAt: 0,
  categories: [],
  products: [],
  carouselSlides: [],
  compoundCards: [],
  whatsappTemplate: null,
  whatsappScope: '__global__',
  selectedSampleIndex: 0,
  productFilters: {
    search: '',
    categoryId: 'all',
    status: 'all',
    bestseller: 'all',
    sort: 'newest',
    page: 1,
    pageSize: 12,
  },
  selectedProductIds: new Set(),
  isFormDirty: false,
};

/** @type {Set<(state: AdminState, changedKeys: string[]) => void>} */
const listeners = new Set();

/**
 * Lê o tema salvo em `localStorage` ou consulta `prefers-color-scheme`.
 * @returns {'light' | 'dark'}
 */
function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignora bloqueio de storage
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Lê o estado de colapso da sidebar no desktop.
 * @returns {boolean}
 */
function getInitialSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Aplica o tema atual (`light` ou `dark`) no atributo `data-theme` do `<html>`.
 * @param {'light' | 'dark'} theme
 */
export function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Alterna entre tema claro e escuro e persiste no `localStorage`.
 */
export function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Ignora erro de storage
  }
  applyThemeToDocument(next);
  setState({ theme: next });
}

/**
 * Alterna o recolhimento da sidebar no desktop.
 */
export function toggleSidebarCollapsed() {
  const next = !state.sidebarCollapsed;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
  } catch {
    // Ignora erro de storage
  }
  setState({ sidebarCollapsed: next });
}

/**
 * Atualiza parcialmente o estado e notifica ouvintes inscritos.
 * @param {Partial<AdminState>} partial
 */
export function setState(partial) {
  const changedKeys = Object.keys(partial);
  Object.assign(state, partial);
  for (const listener of listeners) {
    try {
      listener(state, changedKeys);
    } catch (err) {
      console.error('[AdminState] Erro em listener:', err);
    }
  }
}

/**
 * Inscreve uma função para reagir a mudanças no estado.
 * @param {(state: AdminState, changedKeys: string[]) => void} listener
 * @returns {() => void} Função de desinscrição
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Limpa todo o estado sensível ao encerrar a sessão.
 */
export function resetAuthenticatedState() {
  state.session = null;
  state.userEmail = '';
  state.currentUserId = '';
  state.categories = [];
  state.products = [];
  state.carouselSlides = [];
  state.compoundCards = [];
  state.whatsappTemplate = null;
  state.whatsappScope = '__global__';
  state.lastFetchedAt = 0;
  state.selectedProductIds.clear();
  state.isFormDirty = false;
  setState({
    session: null,
    userEmail: '',
  });
}

