// @ts-check
/**
 * Controle de timeout por inatividade para sessões administrativas.
 * Encerra automaticamente sessões inativas após 30 minutos (configurável),
 * exibindo aviso 1 minuto antes e permitindo prolongar sem perda de formulário sujo.
 *
 * @module js/admin/sessionTimeout
 */

import { state } from './state.js';

/** Tempo máximo de inatividade administrativa antes do logout automático (30 min). */
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Antecedência do aviso antes do logout automático (1 min). */
export const ADMIN_IDLE_WARNING_BEFORE_MS = 60 * 1000;

/** Intervalo mínimo entre reinícios de timer por eventos contínuos de ponteiro/teclado. */
const ACTIVITY_THROTTLE_MS = 1000;

/**
 * Cria controlador de sessão ociosa no painel administrativo.
 *
 * @param {{
 *   timeoutMs?: number,
 *   warningBeforeMs?: number,
 *   onExtend?: () => Promise<void> | void,
 *   onExpire: () => Promise<void> | void,
 *   onLogoutNow?: () => Promise<void> | void,
 * }} options
 */
export function createIdleSessionGuard(options) {
  const timeoutMs = Math.max(2000, Number(options?.timeoutMs) || ADMIN_IDLE_TIMEOUT_MS);
  const warningBeforeMs = Math.min(
    Math.floor(timeoutMs / 2),
    Math.max(1000, Number(options?.warningBeforeMs) || ADMIN_IDLE_WARNING_BEFORE_MS)
  );

  let isRunning = false;
  let isWarningVisible = false;
  let lastActivityAt = Date.now();
  let lastThrottleAt = 0;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let warningTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let expireTimer = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  let countdownInterval = null;

  const modal = () =>
    /** @type {HTMLDialogElement | null} */ (document.getElementById('idle-warning-modal'));
  const messageEl = () => document.getElementById('idle-modal-message');
  const countdownEl = () => document.getElementById('idle-modal-countdown');
  const extendBtn = () =>
    /** @type {HTMLButtonElement | null} */ (document.getElementById('idle-modal-btn-extend'));
  const logoutNowBtn = () =>
    /** @type {HTMLButtonElement | null} */ (document.getElementById('idle-modal-btn-logout'));

  function clearTimers() {
    if (warningTimer) {
      clearTimeout(warningTimer);
      warningTimer = null;
    }
    if (expireTimer) {
      clearTimeout(expireTimer);
      expireTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function closeWarningModal() {
    isWarningVisible = false;
    const dialog = modal();
    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  function updateCountdownText(expiresAt) {
    const target = countdownEl();
    if (!target) return;
    const remainingSec = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    target.textContent = `${remainingSec}s`;
  }

  function showWarningModal(remainingMs) {
    if (!isRunning || isWarningVisible) return;
    isWarningVisible = true;

    const msg = messageEl();
    if (msg) {
      msg.textContent = state.isFormDirty
        ? 'Há alterações não salvas em aberto no painel. Sua sessão será encerrada por inatividade em breve. Prolongue a sessão para continuar editando sem perder seus dados.'
        : 'Sua sessão administrativa está inativa e será encerrada por segurança em breve.';
    }

    const expiresAt = Date.now() + Math.max(0, remainingMs);
    updateCountdownText(expiresAt);

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      updateCountdownText(expiresAt);
    }, 1000);

    const dialog = modal();
    if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
      extendBtn()?.focus();
    }
  }

  async function triggerExpire() {
    if (!isRunning) return;
    stop();
    await options.onExpire();
  }

  function scheduleTimers(fromTimestamp = Date.now()) {
    clearTimers();
    if (!isRunning) return;

    const elapsed = Math.max(0, Date.now() - fromTimestamp);
    const remainingTotal = Math.max(0, timeoutMs - elapsed);
    const remainingToWarning = remainingTotal - warningBeforeMs;

    if (remainingTotal <= 0) {
      void triggerExpire();
      return;
    }

    if (remainingToWarning <= 0) {
      showWarningModal(remainingTotal);
      expireTimer = setTimeout(() => {
        void triggerExpire();
      }, remainingTotal);
      return;
    }

    warningTimer = setTimeout(() => {
      showWarningModal(warningBeforeMs);
    }, remainingToWarning);

    expireTimer = setTimeout(() => {
      void triggerExpire();
    }, remainingTotal);
  }

  function recordActivity() {
    if (!isRunning || isWarningVisible) return;
    const now = Date.now();
    if (now - lastThrottleAt < ACTIVITY_THROTTLE_MS) return;
    lastThrottleAt = now;
    lastActivityAt = now;
    scheduleTimers(now);
  }

  function onVisibilityChange() {
    if (!isRunning || document.visibilityState !== 'visible') return;
    const elapsed = Date.now() - lastActivityAt;
    if (elapsed >= timeoutMs) {
      void triggerExpire();
    } else if (elapsed >= timeoutMs - warningBeforeMs && !isWarningVisible) {
      scheduleTimers(lastActivityAt);
    }
  }

  async function extendSession() {
    if (!isRunning) return;
    closeWarningModal();
    lastActivityAt = Date.now();
    lastThrottleAt = lastActivityAt;
    scheduleTimers(lastActivityAt);
    if (typeof options.onExtend === 'function') {
      try {
        await options.onExtend();
      } catch {
        /* Mantém sessão local ativa em caso de indisponibilidade transitória de refresh */
      }
    }
  }

  async function handleLogoutNowClick() {
    if (!isRunning) return;
    stop();
    if (typeof options.onLogoutNow === 'function') {
      await options.onLogoutNow();
    } else {
      await options.onExpire();
    }
  }

  /** @param {Event} event */
  function onDialogCancel(event) {
    event.preventDefault();
    void extendSession();
  }

  const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

  function start() {
    if (isRunning) return;
    isRunning = true;
    lastActivityAt = Date.now();
    lastThrottleAt = lastActivityAt;

    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', onVisibilityChange);
    extendBtn()?.addEventListener('click', extendSession);
    logoutNowBtn()?.addEventListener('click', handleLogoutNowClick);
    modal()?.addEventListener('cancel', onDialogCancel);

    scheduleTimers(lastActivityAt);
  }

  function stop() {
    if (!isRunning && !warningTimer && !expireTimer) return;
    isRunning = false;
    clearTimers();
    closeWarningModal();

    ACTIVITY_EVENTS.forEach((evt) => {
      window.removeEventListener(evt, recordActivity);
    });
    document.removeEventListener('visibilitychange', onVisibilityChange);
    extendBtn()?.removeEventListener('click', extendSession);
    logoutNowBtn()?.removeEventListener('click', handleLogoutNowClick);
    modal()?.removeEventListener('cancel', onDialogCancel);
  }

  return {
    start,
    stop,
    extendSession,
    isActive: () => isRunning,
  };
}
