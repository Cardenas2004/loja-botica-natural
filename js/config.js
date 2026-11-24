/**
 * @fileoverview Configuração Centralizada — Botica Natural (Single Source of Truth)
 * @description Centraliza nome da marca, domínio canônico, telefone oficial do WhatsApp
 * e parâmetros globais consumidos por `app.js`, `main.js`, `whatsapp.js` e `product.js`.
 *
 * @module js/config
 */

/**
 * Nome oficial padronizado da marca em todo o projeto (confirmado pelo proprietário).
 */
export const BRAND_NAME = 'Botica Natural';

/**
 * Horário oficial de atendimento confirmado pelo proprietário.
 */
export const BUSINESS_HOURS_TEXT = 'Seg a Sex 08:30–12:00 e 13:30–18:00; Sáb 08:30–12:00';

/**
 * Endereço físico oficial confirmado pelo proprietário.
 */
export const BUSINESS_ADDRESS_TEXT = 'Rua Assis Brasil, 31, Centro, Triunfo/RS';

/**
 * Domínio canônico oficial confirmado pelo proprietário, usado em URLs absolutas,
 * canonical, Open Graph, Sitemap e JSON-LD.
 */
export const SITE_DOMAIN = 'https://boticanaturaltriunfo.com.br';

/**
 * Identificador da conta de WhatsApp usado nos links `wa.me` (DDI + DDD + Número, apenas dígitos).
 *
 * Atenção: contas de WhatsApp registradas antes do nono dígito continuam com o ID antigo
 * (sem o 9). Este é o formato que já abre a conversa correta; um link com o 9 pode abrir
 * outro contato. Não troque por PHONE_E164 sem testar o link `wa.me` em um celular.
 */
export const WHATSAPP_PHONE = '555185543448';

/**
 * Telefone discável oficial (E.164 sem o "+", com o nono dígito) para links `tel:` e JSON-LD.
 */
export const PHONE_E164 = '5551985543448';

/**
 * Exibição formatada do telefone/WhatsApp para interface humana.
 */
export const WHATSAPP_DISPLAY = '(51) 98554-3448';

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
 * Indica se parcelamento comercial deve ser exibido publicamente nos cards.
 * Definido como false por padrão até confirmação comercial/farmacêutica.
 */
export const SHOW_INSTALLMENTS = false;

/**
 * Configuração de Analytics (GA4 e Meta Pixel), desligada por padrão.
 * Os scripts externos só são carregados após consentimento LGPD explícito.
 */
export const ANALYTICS = Object.freeze({
  // [PREENCHER: IDs de GA4 e Meta Pixel após decisão comercial, ou confirmar desabilitado]
  ga4MeasurementId: '',
  metaPixelId: '',
});

/**
 * Objeto congelado de configuração do WhatsApp e vitrine.
 */
export const SITE_CONFIG = Object.freeze({
  BRAND_NAME,
  BUSINESS_HOURS_TEXT,
  BUSINESS_ADDRESS_TEXT,
  SITE_DOMAIN,
  WHATSAPP_PHONE,
  PHONE_E164,
  WHATSAPP_DISPLAY,
  ASSET_VERSION,
  LGPD_CONSENT_KEY,
  DEFAULT_WHATSAPP_GREETING,
  WHATSAPP_BASE_URL: 'https://wa.me',
  ALLOWED_WHATSAPP_HOSTS: Object.freeze(['wa.me', 'api.whatsapp.com']),
  SHOW_INSTALLMENTS,
  MAX_INSTALLMENTS: 6,
  MAX_BESTSELLERS: 12,
  ANALYTICS,
});

