export const ASSET_PRIORITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  IMPORTANT: 'IMPORTANT',
  LAZY: 'LAZY'
});

const PRIORITY_ORDER = Object.freeze({CRITICAL: 0, IMPORTANT: 1, LAZY: 2});

function normalizedPriority(value) {
  return Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, value) ? value : ASSET_PRIORITY.LAZY;
}

/**
 * Promise-aware asset cache. A failed request is deliberately removed so a
 * retry button can perform a real second attempt instead of reusing a rejected
 * promise.
 */
export class AssetManager {
  constructor() {
    this.entries = new Map();
    this.sequence = 0;
  }

  load(key, loader, {type = 'asset', url = String(key), priority = ASSET_PRIORITY.LAZY} = {}) {
    if (!key || typeof loader !== 'function') throw new TypeError('AssetManager necesita una clave y un loader.');
    const cached = this.entries.get(key);
    if (cached) {
      cached.hits += 1;
      if (PRIORITY_ORDER[normalizedPriority(priority)] < PRIORITY_ORDER[cached.priority]) cached.priority = normalizedPriority(priority);
      return cached.promise;
    }
    const entry = {
      key, type, url, priority: normalizedPriority(priority), state: 'loading', value: null,
      error: null, hits: 0, references: 0, order: this.sequence++, startedAt: performance.now?.() ?? Date.now(), finishedAt: null
    };
    entry.promise = Promise.resolve().then(loader).then(value => {
      entry.state = 'ready'; entry.value = value; entry.finishedAt = performance.now?.() ?? Date.now(); return value;
    }).catch(error => {
      entry.state = 'error'; entry.error = error; entry.finishedAt = performance.now?.() ?? Date.now();
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, entry);
    return entry.promise;
  }

  loadGLTF(loader, url, options = {}) {
    if (!loader?.loadAsync) throw new TypeError('GLTFLoader inválido.');
    return this.load(`gltf:${url}`, () => loader.loadAsync(url), {type: 'gltf', url, ...options});
  }

  loadAnimation(loader, url, options = {}) {
    if (!loader?.loadAsync) throw new TypeError('Loader de animación inválido.');
    return this.load(`animation:${url}`, () => loader.loadAsync(url), {type: 'animation', url, ...options});
  }

  loadTexture(loader, url, options = {}) {
    if (!loader?.loadAsync) throw new TypeError('TextureLoader inválido.');
    return this.load(`texture:${url}`, () => loader.loadAsync(url), {type: 'texture', url, ...options});
  }

  has(key) { return this.entries.has(key); }
  peek(key) { return this.entries.get(key)?.value ?? null; }
  retain(key) { const entry = this.entries.get(key); if (entry) entry.references += 1; return entry?.value ?? null; }
  release(key) { const entry = this.entries.get(key); if (entry) entry.references = Math.max(0, entry.references - 1); return entry?.references ?? 0; }

  evict(key, disposer) {
    const entry = this.entries.get(key);
    if (!entry || entry.references > 0) return false;
    if (entry.state === 'ready') disposer?.(entry.value);
    this.entries.delete(key);
    return true;
  }

  clear({includeReferenced = false, disposer} = {}) {
    for (const [key, entry] of this.entries) {
      if (!includeReferenced && entry.references > 0) continue;
      if (entry.state === 'ready') disposer?.(entry.value, entry);
      this.entries.delete(key);
    }
  }

  diagnostics() {
    const assets = [...this.entries.values()].map(entry => ({
      key: entry.key, type: entry.type, url: entry.url, priority: entry.priority,
      state: entry.state, hits: entry.hits, references: entry.references,
      durationMs: entry.finishedAt == null ? null : Math.round((entry.finishedAt - entry.startedAt) * 10) / 10
    }));
    return {
      count: assets.length,
      ready: assets.filter(asset => asset.state === 'ready').length,
      loading: assets.filter(asset => asset.state === 'loading').length,
      byPriority: Object.fromEntries(Object.values(ASSET_PRIORITY).map(priority => [priority, assets.filter(asset => asset.priority === priority).length])),
      assets
    };
  }
}

export const assetManager = new AssetManager();
