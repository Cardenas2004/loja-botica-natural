// @ts-check
/**
 * Camada de dados e Storage do Painel Administrativo (Supabase singleton).
 * Inclui cache em memória com invalidação automática e pipeline de compressão WebP.
 */

import {
  supabase,
  DB_TABLES,
  STORAGE_BUCKET,
  getProductImageUrl,
  isTrustedStorageUrl,
  normalizeSupabaseError,
} from '../supabaseClient.js';

import {
  DEFAULT_PRODUCT_MESSAGE_TEMPLATE,
  fetchProductWhatsAppTemplate,
  saveProductWhatsAppTemplate,
  saveIndividualProductWhatsAppMessage,
} from '../whatsapp.js';

import { state, setState } from './state.js';
import { showToast, generateSlug } from './ui.js';

export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_RAW_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB entrada bruta
export const MAX_STORAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB limite do bucket

const CACHE_TTL_MS = 60_000;

export const FALLBACK_ADMIN_THUMB =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='12' fill='%23F4EEFA'/><path d='M36 28h24v8H36zM32 36h32a4 4 0 0 1 4 4v28a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8V40a4 4 0 0 1 4-4zm16 10v16m-8-8h16' stroke='%233D1E6D' stroke-width='3' stroke-linecap='round' fill='none' opacity='0.55'/></svg>";

export const FALLBACK_SLIDE_THUMB =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='216' viewBox='0 0 640 216'><rect width='640' height='216' fill='%232B154D'/><text x='50%25' y='52%25' text-anchor='middle' fill='%23F4EEFA' font-family='Inter, sans-serif' font-size='16' font-weight='600'>Banner 1920x650 — Botica Natural</text></svg>";

/**
 * Resolve a URL segura de miniatura de um produto ou banner validando o host do Supabase Storage.
 * @param {any} item
 * @param {string} [fallback=FALLBACK_ADMIN_THUMB]
 * @returns {string}
 */
export function resolveAdminImageUrl(item, fallback = FALLBACK_ADMIN_THUMB) {
  if (!item) return fallback;
  if (typeof item.image_url === 'string' && isTrustedStorageUrl(item.image_url.trim())) {
    return item.image_url.trim();
  }
  if (typeof item.image_path === 'string' && item.image_path.trim() !== '') {
    const publicUrl = getProductImageUrl(item.image_path.trim());
    if (isTrustedStorageUrl(publicUrl)) return publicUrl;
  }
  return fallback;
}

/**
 * Valida se uma URL de botão do carrossel é segura (`https:`, `http:` ou caminho relativo).
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isValidBannerLink(rawUrl) {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return true; // opcional
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\') || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return false;
  }
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1].toLowerCase()}:`;
    if (scheme !== 'https:' && scheme !== 'http:') return false;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }
  return !trimmed.includes(':');
}

/* ==========================================================================
   1. PIPELINE DE IMAGEM WEBP E SUPABASE STORAGE
   ========================================================================== */

/**
 * Valida tipo MIME e tamanho do arquivo de imagem selecionado.
 * @param {File | null | undefined} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) return { valid: false, error: 'Nenhum arquivo selecionado.' };
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: 'Formato não suportado. Envie uma imagem JPG, PNG ou WebP.',
    };
  }
  if (file.size > MAX_RAW_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'A imagem selecionada excede 10 MB. Escolha um arquivo menor.',
    };
  }
  return { valid: true };
}

/**
 * Converte e redimensiona uma imagem no navegador para `image/webp` garantindo `<= 2 MB`.
 * @param {File} file
 * @param {{ maxDimension?: number, quality?: number, onProgress?: (pct: number) => void }} [options]
 * @returns {Promise<Blob>}
 */
export function convertImageFileToWebp(file, options = {}) {
  const maxDimension = options.maxDimension ?? 1280;
  const initialQuality = options.quality ?? 0.84;
  const onProgress = options.onProgress;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (onProgress) onProgress(35);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width <= 0 || height <= 0) {
        reject(new Error('Dimensões de imagem inválidas.'));
        return;
      }

      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Contexto gráfico 2D indisponível neste navegador.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      if (onProgress) onProgress(60);

      const encodeWithQuality = (/** @type {number} */ q) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Não foi possível converter a imagem para WebP.'));
              return;
            }
            if (blob.size > MAX_STORAGE_UPLOAD_BYTES && q > 0.5) {
              encodeWithQuality(Number((q - 0.1).toFixed(2)));
              return;
            }
            if (blob.size > MAX_STORAGE_UPLOAD_BYTES) {
              reject(new Error('Mesmo após otimização, a imagem excedeu 2 MB.'));
              return;
            }
            if (onProgress) onProgress(80);
            resolve(blob);
          },
          'image/webp',
          q
        );
      };

      encodeWithQuality(initialQuality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Arquivo de imagem corrompido ou ilegível.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Faz upload de uma imagem convertida em WebP para o bucket `product-images`.
 * @param {File} file
 * @param {{ folder?: 'catalogo' | 'carousel', maxDimension?: number, quality?: number, onProgress?: (pct: number) => void }} [options]
 * @returns {Promise<{ imagePath: string, imageUrl: string }>}
 */
export async function uploadStorageWebpImage(file, options = {}) {
  const check = validateImageFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const folder = options.folder || 'catalogo';
  const maxDimension = options.maxDimension ?? (folder === 'carousel' ? 1920 : 1280);
  const quality = options.quality ?? (folder === 'carousel' ? 0.85 : 0.84);

  if (options.onProgress) options.onProgress(15);
  const webpBlob = await convertImageFileToWebp(file, {
    maxDimension,
    quality,
    onProgress: options.onProgress,
  });

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const safeBaseName = generateSlug(baseName) || (folder === 'carousel' ? 'banner' : 'produto');
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const storagePath = `${folder}/${Date.now()}-${randomSuffix}-${safeBaseName}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, webpBlob, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  if (options.onProgress) options.onProgress(100);
  const publicUrl = getProductImageUrl(storagePath);
  return { imagePath: storagePath, imageUrl: publicUrl };
}

/**
 * Remove um arquivo antigo do Supabase Storage de forma silenciosa para evitar órfãos.
 * @param {string | null | undefined} imagePath
 */
export async function removeStorageImageIfPresent(imagePath) {
  const cleanPath = String(imagePath || '').trim();
  if (!cleanPath) return;
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove([cleanPath]);
  } catch (err) {
    console.warn('[AdminAPI] Aviso ao remover imagem antiga do Storage:', err);
  }
}

/* ==========================================================================
   2. LEITURA DE DADOS COM CACHE E INVALIDAÇÃO
   ========================================================================== */

/**
 * Invalida o timestamp do cache em memória.
 */
export function invalidateCache() {
  state.lastFetchedAt = 0;
}

/**
 * Carrega todas as entidades necessárias ao painel administrativo.
 * @param {{ force?: boolean }} [options]
 */
export async function fetchAllAdminData(options = {}) {
  const now = Date.now();
  if (!options.force && state.lastFetchedAt > 0 && now - state.lastFetchedAt < CACHE_TTL_MS) {
    return;
  }

  setState({ isLoadingData: true });
  try {
    await Promise.all([
      fetchCategories(),
      fetchProducts(),
      fetchCarouselSlides(),
      fetchWhatsAppSettings(),
    ]);
    setState({ lastFetchedAt: Date.now() });
  } finally {
    setState({ isLoadingData: false });
  }
}

/**
 * Busca todas as categorias ordenadas por `display_order` ASC e `name` ASC.
 */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from(DB_TABLES.CATEGORIES)
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    const normalized = normalizeSupabaseError(error, 'Erro ao carregar categorias');
    showToast(normalized.userMessage, 'error');
    return [];
  }

  const list = Array.isArray(data) ? data : [];
  setState({ categories: list });
  return list;
}

/**
 * Busca todos os produtos ordenados pelos mais recentes.
 */
export async function fetchProducts() {
  const { data, error } = await supabase
    .from(DB_TABLES.PRODUCTS)
    .select('*, categories(id, name, slug)')
    .order('created_at', { ascending: false });

  if (error) {
    const normalized = normalizeSupabaseError(error, 'Erro ao carregar produtos');
    showToast(normalized.userMessage, 'error');
    return [];
  }

  const list = Array.isArray(data) ? data : [];
  setState({ products: list });
  return list;
}

/**
 * Busca todos os banners do carrossel ordenados por `display_order` ASC.
 */
export async function fetchCarouselSlides() {
  const { data, error } = await supabase
    .from(DB_TABLES.CAROUSEL)
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    const code = String(error.code || '');
    if (code === '42P01' || code === 'PGRST205') {
      setState({ carouselSlides: [] });
      return [];
    }
    const normalized = normalizeSupabaseError(error, 'Erro ao carregar banners');
    showToast(normalized.userMessage, 'error');
    return [];
  }

  const list = Array.isArray(data) ? data : [];
  setState({ carouselSlides: list });
  return list;
}

/**
 * Carrega o template global do WhatsApp salvo em `site_settings`.
 */
export async function fetchWhatsAppSettings() {
  try {
    const template = await fetchProductWhatsAppTemplate(true);
    setState({ whatsappTemplate: template || DEFAULT_PRODUCT_MESSAGE_TEMPLATE });
  } catch {
    setState({ whatsappTemplate: DEFAULT_PRODUCT_MESSAGE_TEMPLATE });
  }
}

/* ==========================================================================
   3. OPERAÇÕES CRUD: CATEGORIAS
   ========================================================================== */

/**
 * Cria ou atualiza uma categoria.
 * @param {{ name: string, slug: string, display_order: number, is_active: boolean }} payload
 * @param {string} [editingId]
 */
export async function saveCategory(payload, editingId = '') {
  const record = {
    name: payload.name.trim(),
    slug: generateSlug(payload.slug || payload.name),
    display_order: Math.max(0, Number(payload.display_order) || 0),
    is_active: Boolean(payload.is_active),
    updated_at: new Date().toISOString(),
  };

  const query = editingId
    ? supabase.from(DB_TABLES.CATEGORIES).update(record).eq('id', editingId)
    : supabase.from(DB_TABLES.CATEGORIES).insert([record]);

  const { error } = await query;
  if (error) throw error;

  invalidateCache();
  await Promise.all([fetchCategories(), fetchProducts()]);
}

/**
 * Exclui uma categoria pelo ID.
 * @param {string} categoryId
 */
export async function deleteCategoryById(categoryId) {
  const { error } = await supabase.from(DB_TABLES.CATEGORIES).delete().eq('id', categoryId);
  if (error) throw error;

  invalidateCache();
  await Promise.all([fetchCategories(), fetchProducts()]);
}

/* ==========================================================================
   4. OPERAÇÕES CRUD: BANNERS DO CARROSSEL
   ========================================================================== */

/**
 * Cria ou atualiza um slide do carrossel com upload WebP opcional e limpeza de órfãos.
 * @param {{
 *   title: string,
 *   button_link: string,
 *   display_order: number,
 *   is_active: boolean
 * }} payload
 * @param {{
 *   editingId?: string,
 *   oldImagePath?: string,
 *   file?: File | null,
 *   onProgress?: (pct: number) => void
 * }} [options]
 */
export async function saveCarouselSlide(payload, options = {}) {
  const editingId = options.editingId || '';
  const oldImagePath = options.oldImagePath || '';
  const file = options.file || null;

  if (!isValidBannerLink(payload.button_link)) {
    throw new Error('Link do banner inválido. Use https://, http:// ou um caminho relativo.');
  }

  /** @type {{ imagePath: string, imageUrl: string } | null} */
  let uploaded = null;

  try {
    if (file) {
      uploaded = await uploadStorageWebpImage(file, {
        folder: 'carousel',
        maxDimension: 1920,
        quality: 0.85,
        onProgress: options.onProgress,
      });
    }

    /** @type {Record<string, any>} */
    const record = {
      title: payload.title.trim(),
      button_link: payload.button_link.trim(),
      display_order: Math.max(0, Number(payload.display_order) || 0),
      is_active: Boolean(payload.is_active),
      updated_at: new Date().toISOString(),
    };

    if (uploaded) {
      record.image_path = uploaded.imagePath;
      record.image_url = uploaded.imageUrl;
    }

    const query = editingId
      ? supabase.from(DB_TABLES.CAROUSEL).update(record).eq('id', editingId)
      : supabase.from(DB_TABLES.CAROUSEL).insert([record]);

    const { error } = await query;
    if (error) throw error;

    if (editingId && uploaded && oldImagePath && oldImagePath !== uploaded.imagePath) {
      await removeStorageImageIfPresent(oldImagePath);
    }

    invalidateCache();
    await fetchCarouselSlides();
  } catch (err) {
    if (uploaded?.imagePath) {
      await removeStorageImageIfPresent(uploaded.imagePath);
    }
    throw err;
  }
}

/**
 * Exclui um banner do carrossel e remove sua imagem do Storage.
 * @param {any} slide
 */
export async function deleteCarouselSlide(slide) {
  const { error } = await supabase.from(DB_TABLES.CAROUSEL).delete().eq('id', slide.id);
  if (error) throw error;

  if (slide.image_path) {
    await removeStorageImageIfPresent(slide.image_path);
  }

  invalidateCache();
  await fetchCarouselSlides();
}

/**
 * Atualiza a ordem de exibição (`display_order`) de uma lista ordenada de IDs de banners.
 * @param {string[]} orderedIds
 */
export async function reorderCarouselSlides(orderedIds) {
  const updates = orderedIds.map((id, index) =>
    supabase
      .from(DB_TABLES.CAROUSEL)
      .update({ display_order: index + 1, updated_at: new Date().toISOString() })
      .eq('id', id)
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;

  invalidateCache();
  await fetchCarouselSlides();
}

/* ==========================================================================
   5. OPERAÇÕES CRUD: PRODUTOS (INDIVIDUAL E EM MASSA)
   ========================================================================== */

/**
 * Cria ou atualiza um produto com suporte a `text_options` (e fallback caso a coluna ainda não exista).
 * @param {Record<string, any>} payload
 * @param {{
 *   editingId?: string,
 *   oldImagePath?: string,
 *   file?: File | null,
 *   onProgress?: (pct: number) => void
 * }} [options]
 * @returns {Promise<any>} Registro salvo
 */
export async function saveProductRecord(payload, options = {}) {
  const editingId = options.editingId || '';
  const oldImagePath = options.oldImagePath || '';
  const file = options.file || null;

  /** @type {{ imagePath: string, imageUrl: string } | null} */
  let uploaded = null;

  try {
    if (file) {
      uploaded = await uploadStorageWebpImage(file, {
        folder: 'catalogo',
        maxDimension: 1280,
        quality: 0.84,
        onProgress: options.onProgress,
      });
    }

    /** @type {Record<string, any>} */
    const record = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (uploaded) {
      record.image_path = uploaded.imagePath;
      record.image_url = uploaded.imageUrl;
    }

    const executeQuery = async (/** @type {Record<string, any>} */ dataToSave) => {
      if (editingId) {
        return supabase
          .from(DB_TABLES.PRODUCTS)
          .update(dataToSave)
          .eq('id', editingId)
          .select('*, categories(id, name, slug)')
          .maybeSingle();
      }
      return supabase
        .from(DB_TABLES.PRODUCTS)
        .insert([dataToSave])
        .select('*, categories(id, name, slug)')
        .maybeSingle();
    };

    let { data, error } = await executeQuery(record);

    // Fallback defensivo se a migração `text_options` ainda não foi rodada no banco
    if (error && String(error.message || '').includes('text_options')) {
      const { text_options: _ignored, ...fallbackRecord } = record;
      const retry = await executeQuery(fallbackRecord);
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    if (editingId && uploaded && oldImagePath && oldImagePath !== uploaded.imagePath) {
      await removeStorageImageIfPresent(oldImagePath);
    }

    invalidateCache();
    await fetchProducts();
    return data;
  } catch (err) {
    if (uploaded?.imagePath) {
      await removeStorageImageIfPresent(uploaded.imagePath);
    }
    throw err;
  }
}

/**
 * Duplica um produto existente criando uma cópia "(Cópia)" inativa para revisão segura.
 * @param {any} sourceProduct
 * @returns {Promise<any>}
 */
export async function duplicateProductRecord(sourceProduct) {
  const copyName = `${String(sourceProduct.name || 'Produto').slice(0, 185)} (Cópia)`;
  /** @type {Record<string, any>} */
  const payload = {
    name: copyName,
    sku_ref: sourceProduct.sku_ref ? `${sourceProduct.sku_ref}-COPIA` : '',
    category_id: sourceProduct.category_id || null,
    price: Number(sourceProduct.price) || 0,
    short_description: sourceProduct.short_description || '',
    payment_info:
      sourceProduct.payment_info || 'Consulte formas de pagamento via WhatsApp / Cartão e Pix',
    description: sourceProduct.description || '',
    usage_instructions: sourceProduct.usage_instructions || '',
    composition: sourceProduct.composition || '',
    package_info: sourceProduct.package_info || '',
    allergen_info: sourceProduct.allergen_info || 'Não contém lactose e glúten.',
    quality_note: sourceProduct.quality_note || '',
    whatsapp_message: sourceProduct.whatsapp_message || '',
    text_options: sourceProduct.text_options || {},
    // Mantém apenas a URL pública de imagem para não compartilhar o mesmo image_path físico na exclusão
    image_url: sourceProduct.image_url || '',
    image_path: '',
    is_active: false,
    is_best_seller: Boolean(sourceProduct.is_best_seller),
  };

  return saveProductRecord(payload);
}

/**
 * Alterna rapidamente o status `is_active` de um único produto.
 * @param {string} productId
 * @param {boolean} isActive
 */
export async function toggleProductStatus(productId, isActive) {
  const { error } = await supabase
    .from(DB_TABLES.PRODUCTS)
    .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (error) throw error;
  invalidateCache();
  await fetchProducts();
}

/**
 * Ativa ou desativa múltiplos produtos selecionados em massa.
 * @param {string[]} productIds
 * @param {boolean} isActive
 */
export async function bulkUpdateProductsStatus(productIds, isActive) {
  if (!Array.isArray(productIds) || productIds.length === 0) return;
  const { error } = await supabase
    .from(DB_TABLES.PRODUCTS)
    .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
    .in('id', productIds);

  if (error) throw error;
  invalidateCache();
  await fetchProducts();
}

/**
 * Exclui um produto e apaga sua imagem física do Storage se houver `image_path`.
 * @param {any} product
 */
export async function deleteProductRecord(product) {
  const { error } = await supabase.from(DB_TABLES.PRODUCTS).delete().eq('id', product.id);
  if (error) throw error;

  if (product.image_path) {
    await removeStorageImageIfPresent(product.image_path);
  }

  invalidateCache();
  await fetchProducts();
}

/* ==========================================================================
   6. OPERAÇÕES DE TEMPLATE DO WHATSAPP
   ========================================================================== */

/**
 * Salva o template global ou a mensagem individual de um produto para o WhatsApp.
 * @param {{ scope: string, templateText: string, adminEmail: string }} params
 */
export async function saveWhatsAppConfiguration({ scope, templateText, adminEmail }) {
  if (scope === '__global__') {
    await saveProductWhatsAppTemplate(templateText, adminEmail);
    setState({ whatsappTemplate: templateText });
  } else {
    await saveIndividualProductWhatsAppMessage(scope, templateText, adminEmail);
    invalidateCache();
    await fetchProducts();
  }
}

