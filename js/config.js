/**
 * @fileoverview Configuração Centralizada — Botica Natural (Single Source of Truth)
 * @description Centraliza nome da marca, domínio canônico, telefone oficial do WhatsApp
 * e parâmetros globais consumidos por `app.js`, `main.js`, `whatsapp.js` e `product.js`.
 *
 * @module js/config
 */

/**
 * Nome oficial padronizado da marca em todo o projeto.
 * [PREENCHER: confirmar com o proprietário se o nome empresarial/fantasia oficial é "Botica Natural"]
 */
export const BRAND_NAME = 'Botica Natural';

/**
 * Domínio canônico oficial usado em URLs absolutas, canonical, Open Graph e JSON-LD.
 * [PREENCHER: confirmar domínio oficial de produção]
 */
export const SITE_DOMAIN = 'https://www.boticanatural.com.br';

/**
 * Número oficial de WhatsApp da farmácia em formato internacional (DDI + DDD + Número, apenas dígitos).
 */
export const WHATSAPP_PHONE = '555185543448';

/**
 * Exibição formatada do telefone/WhatsApp para interface humana.
 */
export const WHATSAPP_DISPLAY = '(51) 8554-3448';

/**
 * Versão única de cache-busting para assets estáticos (`?v=`).
 */
export const ASSET_VERSION = '20261104';

/**
 * Chave de armazenamento local para registro de consentimento LGPD.
 */
export const LGPD_CONSENT_KEY = 'bn_lgpd_consent';

/**
 * Mensagem padrão de saudação para atendimento geral via WhatsApp.
 */
export const DEFAULT_WHATSAPP_GREETING = `Olá! Gostaria de fazer um orçamento na ${BRAND_NAME}.`;

/**
 * Objeto congelado de configuração do WhatsApp e vitrine.
 */
export const SITE_CONFIG = Object.freeze({
  BRAND_NAME,
  SITE_DOMAIN,
  WHATSAPP_PHONE,
  WHATSAPP_DISPLAY,
  ASSET_VERSION,
  LGPD_CONSENT_KEY,
  DEFAULT_WHATSAPP_GREETING,
  WHATSAPP_BASE_URL: 'https://wa.me',
  ALLOWED_WHATSAPP_HOSTS: Object.freeze(['wa.me', 'api.whatsapp.com']),
  MAX_INSTALLMENTS: 6,
  MAX_BESTSELLERS: 6,
});

