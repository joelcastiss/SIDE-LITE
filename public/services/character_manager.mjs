import {assetManager as sharedAssetManager, ASSET_PRIORITY} from './asset_manager.mjs';

export const CHARACTER_IDS = Object.freeze(['chico1', 'chico2', 'chico3', 'mona']);

export const CHARACTER_CATALOG = Object.freeze({
  chico1: Object.freeze({id: 'chico1', name: 'Gonzalo', gender: 'masculine', model: 'assets/models3d/npcs/chico1.glb'}),
  chico2: Object.freeze({id: 'chico2', name: 'Miguel', gender: 'masculine', model: 'assets/models3d/npcs/chico2.glb'}),
  chico3: Object.freeze({id: 'chico3', name: 'Joel', gender: 'masculine', model: 'assets/models3d/npcs/chico3.glb'}),
  mona: Object.freeze({id: 'mona', name: 'Valeria', gender: 'feminine', model: 'assets/models3d/npcs/mona.glb'})
});

export function isCharacterId(value) { return CHARACTER_IDS.includes(String(value || '')); }

export class CharacterManager {
  constructor({assetManager = sharedAssetManager, storage = globalThis.localStorage, storageKey = 'SIDE_SELECTED_CHARACTER', loadTemplate} = {}) {
    this.assets = assetManager;
    this.storage = storage;
    this.storageKey = storageKey;
    this.loadTemplate = loadTemplate;
    this.selectedId = null;
    this.instances = new Set();
    this.playerInstance = null;
    this.errors = {};
    this.restore();
  }

  setStorageKey(key) {
    this.storageKey = String(key || 'SIDE_SELECTED_CHARACTER');
    return this.restore();
  }

  restore() {
    let value = null;
    try { value = this.storage?.getItem?.(this.storageKey); } catch {}
    this.selectedId = isCharacterId(value) ? value : null;
    return this.selectedId;
  }

  select(id, {persist = true} = {}) {
    if (!isCharacterId(id)) throw new RangeError(`Personaje SIDE desconocido: ${id}`);
    this.selectedId = id;
    if (persist) {
      try { this.storage?.setItem?.(this.storageKey, id); } catch {}
    }
    return CHARACTER_CATALOG[id];
  }

  selected() { return this.selectedId ? CHARACTER_CATALOG[this.selectedId] : null; }
  shouldSpawnNpc(id) { return isCharacterId(id) && id !== this.selectedId; }
  assetKey(id) { return `character:${id}`; }

  async preload(id = this.selectedId, {priority = ASSET_PRIORITY.CRITICAL} = {}) {
    if (!isCharacterId(id)) throw new RangeError(`Personaje SIDE desconocido: ${id}`);
    if (typeof this.loadTemplate !== 'function') throw new TypeError('CharacterManager necesita loadTemplate.');
    const descriptor = CHARACTER_CATALOG[id];
    try {
      const template = await this.assets.load(this.assetKey(id), () => this.loadTemplate(descriptor), {
        type: 'character', url: descriptor.model, priority
      });
      delete this.errors[id];
      return template;
    } catch (error) {
      this.errors[id] = error?.message || String(error);
      throw error;
    }
  }

  template(id) { return this.assets.peek(this.assetKey(id)); }

  async preloadRemaining({priority = ASSET_PRIORITY.IMPORTANT} = {}) {
    return Promise.allSettled(CHARACTER_IDS.filter(id => id !== this.selectedId).map(id => this.preload(id, {priority})));
  }

  create(id, {role = 'npc', factory} = {}) {
    if (!isCharacterId(id)) throw new RangeError(`Personaje SIDE desconocido: ${id}`);
    if (role !== 'player' && !this.shouldSpawnNpc(id)) return null;
    if (role === 'player' && this.playerInstance) return this.playerInstance;
    const template = this.template(id);
    if (!template || typeof factory !== 'function') return null;
    const object = factory(template, id);
    if (!object) return null;
    object.userData ||= {};
    Object.assign(object.userData, {characterId: id, characterName: CHARACTER_CATALOG[id].name, characterRole: role});
    const record = {id, role, object};
    this.instances.add(record);
    if (role === 'player') this.playerInstance = object;
    return object;
  }

  forget(object) {
    for (const record of this.instances) if (record.object === object) this.instances.delete(record);
    if (this.playerInstance === object) this.playerInstance = null;
  }

  disposeInstance(object, disposer) {
    if (!object) return false;
    this.forget(object);
    disposer?.(object);
    return true;
  }

  diagnostics() {
    const instances = [...this.instances].map(({id, role}) => ({id, role}));
    return {
      selected: this.selectedId,
      selectedName: this.selected()?.name || '',
      playerInstances: instances.filter(item => item.role === 'player').length,
      instances,
      duplicates: CHARACTER_IDS.filter(id => instances.filter(item => item.id === id).length > 1),
      loaded: CHARACTER_IDS.filter(id => Boolean(this.template(id))),
      errors: {...this.errors},
      cache: this.assets.diagnostics()
    };
  }
}

export {ASSET_PRIORITY};
