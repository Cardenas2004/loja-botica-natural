// @ts-check
/**
 * View: Segurança & Autenticação em Dois Fatores (`#/seguranca`)
 * Permite inscrever fator TOTP via `supabase.auth.mfa.enroll`, validar o código
 * de ativação com QR code local (`data:image/svg+xml`) ou segredo textual, e
 * gerenciar fatores ativos com proteção anti-lockout.
 */

import {
  inspectMfaAssuranceState,
  startTotpEnrollment,
  verifyTotpChallenge,
  removeMfaFactor,
} from '../auth.js';
import {
  el,
  clearElement,
  createIcon,
  showToast,
  confirmAction,
  setButtonLoading,
  formatDateShort,
} from '../ui.js';

/**
 * Renderiza a view administrativa de configuração de MFA (TOTP).
 * @param {HTMLElement} container
 */
export async function renderSecurityView(container) {
  clearElement(container);

  const statusHost = el('div', { className: 'mfa-status-host' });
  const enrollHost = el('div', { className: 'mfa-enroll-host' });

  const panel = el('section', { className: 'admin-panel mfa-admin-panel' }, [
    el('div', { className: 'admin-panel__header' }, [
      el('div', {}, [
        el('span', { className: 'admin-panel__eyebrow' }, [
          createIcon('fa-solid fa-shield-halved'),
          el('span', { textContent: 'Autenticação em Dois Fatores (2FA)' }),
        ]),
        el('h2', {
          className: 'admin-panel__title',
          textContent: 'Proteção TOTP da Conta Administrativa',
        }),
      ]),
    ]),
    el('div', { className: 'mfa-panel-body' }, [
      el('p', {
        className: 'mfa-intro-text',
        textContent:
          'Ative um aplicativo autenticador (Google Authenticator, 1Password, Authy ou similar) antes de aplicar a exigência estrita de AAL2 no banco de dados.',
      }),
      statusHost,
      enrollHost,
    ]),
  ]);

  container.replaceChildren(panel);

  async function refreshMfaPanel() {
    clearElement(enrollHost);
    const info = await inspectMfaAssuranceState();
    const verifiedTotp = info.allFactors.filter(
      (f) => f.factor_type === 'totp' && f.status === 'verified'
    );

    const isAal2 = info.currentLevel === 'aal2';
    const hasTotp = verifiedTotp.length > 0;

    const statusBadge = el(
      'span',
      {
        id: 'mfa-status-badge',
        className: `badge ${hasTotp ? 'badge-success' : 'badge-warning'}`,
        textContent: hasTotp
          ? isAal2
            ? 'TOTP Ativo (Sessão AAL2)'
            : 'TOTP Cadastrado'
          : 'TOTP Não Configurado (AAL1)',
      }
    );

    const factorsList = el(
      'div',
      { className: 'mfa-factors-list' },
      verifiedTotp.map((factor) =>
        el('div', { className: 'mfa-factor-item', dataset: { factorId: factor.id } }, [
          el('div', { className: 'mfa-factor-item__info' }, [
            el('strong', {
              textContent: factor.friendly_name || 'Autenticador TOTP',
            }),
            el('span', {
              className: 'mfa-factor-item__meta',
              textContent: `Cadastrado em ${formatDateShort(factor.created_at)}`,
            }),
          ]),
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-secondary btn-sm',
              onClick: async () => {
                const confirmed = await confirmAction({
                  title: 'Remover autenticador TOTP',
                  message:
                    'Tem certeza de que deseja remover este fator TOTP? Caso a regra AAL2 esteja ativa no banco, você perderá acesso de escrita até inscrever outro fator.',
                  confirmLabel: 'Remover fator',
                  variant: 'danger',
                });
                if (!confirmed) return;
                const res = await removeMfaFactor(factor.id);
                if (!res.ok) {
                  showToast(res.errorMessage || 'Falha ao remover fator.', 'error');
                  return;
                }
                showToast('Fator TOTP removido com segurança.', 'info');
                await refreshMfaPanel();
              },
            },
            [createIcon('fa-regular fa-trash-can'), el('span', { textContent: 'Remover' })]
          ),
        ])
      )
    );

    const startBtn = /** @type {HTMLButtonElement} */ (
      el(
        'button',
        {
          type: 'button',
          id: 'btn-mfa-enroll-start',
          className: 'btn btn-primary',
          onClick: async () => {
            setButtonLoading(
              startBtn,
              true,
              'Gerando segredo...',
              hasTotp ? 'Adicionar Outro Autenticador' : 'Configurar TOTP',
              'fa-solid fa-shield-halved'
            );
            try {
              const enrolled = await startTotpEnrollment('Botica Natural Admin');
              if (!enrolled.ok || !enrolled.factorId) {
                showToast(
                  enrolled.errorMessage || 'Não foi possível iniciar a inscrição TOTP.',
                  'error'
                );
                return;
              }
              renderEnrollmentStep({
                factorId: enrolled.factorId,
                qrCode: enrolled.qrCode || '',
                secret: enrolled.secret || '',
              });
            } finally {
              setButtonLoading(
                startBtn,
                false,
                'Gerando segredo...',
                hasTotp ? 'Adicionar Outro Autenticador' : 'Configurar TOTP',
                'fa-solid fa-shield-halved'
              );
            }
          },
        },
        [
          createIcon('fa-solid fa-shield-halved'),
          el('span', {
            textContent: hasTotp ? 'Adicionar Outro Autenticador' : 'Configurar TOTP',
          }),
        ]
      )
    );

    statusHost.replaceChildren(
      el('div', { className: 'mfa-status-header' }, [
        el('div', { className: 'mfa-status-summary' }, [
          el('span', { className: 'mfa-status-label', textContent: 'Estado atual:' }),
          statusBadge,
        ]),
        startBtn,
      ]),
      verifiedTotp.length > 0 ? factorsList : null
    );
  }

  /**
   * Exibe o QR Code SVG (quando `data:image/svg+xml`) e o segredo manual para confirmar o TOTP.
   * @param {{ factorId: string, qrCode: string, secret: string }} data
   */
  function renderEnrollmentStep({ factorId, qrCode, secret }) {
    const codeInput = /** @type {HTMLInputElement} */ (
      el('input', {
        type: 'text',
        id: 'mfa-enroll-code',
        name: 'mfa_enroll_code',
        inputmode: 'numeric',
        pattern: '[0-9]{6}',
        maxlength: '6',
        autocomplete: 'one-time-code',
        className: 'form-control',
        placeholder: '000000',
        required: true,
      })
    );

    const confirmBtn = /** @type {HTMLButtonElement} */ (
      el(
        'button',
        {
          type: 'submit',
          id: 'btn-mfa-enroll-confirm',
          className: 'btn btn-primary',
        },
        [createIcon('fa-solid fa-check'), el('span', { textContent: 'Confirmar e Ativar TOTP' })]
      )
    );

    const qrVisual =
      typeof qrCode === 'string' && qrCode.startsWith('data:image/svg+xml')
        ? el('div', { className: 'mfa-qr-wrap' }, [
            el('img', {
              id: 'mfa-enroll-qr',
              src: qrCode,
              alt: 'QR Code para configurar aplicativo autenticador TOTP',
              className: 'mfa-qr-img',
              width: '192',
              height: '192',
            }),
          ])
        : null;

    const enrollForm = el(
      'form',
      {
        id: 'mfa-enroll-verify-form',
        className: 'mfa-enroll-card',
        onSubmit: async (/** @type {SubmitEvent} */ event) => {
          event.preventDefault();
          setButtonLoading(
            confirmBtn,
            true,
            'Validando código...',
            'Confirmar e Ativar TOTP',
            'fa-solid fa-check'
          );
          try {
            const res = await verifyTotpChallenge(factorId, codeInput.value, {
              verifyAdminAfter: false,
            });
            if (!res.ok) {
              showToast(res.errorMessage || 'Código inválido.', 'error');
              codeInput.focus();
              return;
            }
            showToast(
              'MFA TOTP ativado com sucesso! Guarde o acesso ao aplicativo autenticador com segurança.',
              'success'
            );
            await refreshMfaPanel();
          } finally {
            setButtonLoading(
              confirmBtn,
              false,
              'Validando código...',
              'Confirmar e Ativar TOTP',
              'fa-solid fa-check'
            );
          }
        },
      },
      [
        el('h3', {
          className: 'mfa-enroll-card__title',
          textContent: '1. Escaneie o QR Code ou digite a chave secreta no autenticador',
        }),
        qrVisual,
        el('div', { className: 'mfa-secret-wrap' }, [
          el('span', { className: 'mfa-secret-label', textContent: 'Chave secreta (entrada manual):' }),
          el('code', { id: 'mfa-enroll-secret', className: 'mfa-secret-code', textContent: secret || '—' }),
        ]),
        el('div', { className: 'form-group' }, [
          el('label', {
            for: 'mfa-enroll-code',
            className: 'form-label',
            textContent: '2. Digite o código de 6 dígitos exibido no app',
          }),
          codeInput,
        ]),
        el('div', { className: 'mfa-enroll-actions' }, [
          confirmBtn,
          el(
            'button',
            {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: () => clearElement(enrollHost),
            },
            [el('span', { textContent: 'Cancelar' })]
          ),
        ]),
      ]
    );

    enrollHost.replaceChildren(enrollForm);
    codeInput.focus();
  }

  await refreshMfaPanel();
}
