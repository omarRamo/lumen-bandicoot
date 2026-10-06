// Entity factories by type ('crate', 'enemy', …). Modules register themselves at import time.
const factories = new Map();

export function registerEntity(type, factory) {
  factories.set(type, factory);
}

export function hasEntityType(type) {
  return factories.has(type);
}

export function createEntity(def, ctx) {
  const factory = factories.get(def.type);
  if (!factory) {
    console.warn(`[registry] unknown entity type "${def.type}"`);
    return null;
  }
  try {
    return factory(def, ctx) || null;
  } catch (err) {
    console.error(`[registry] failed to create ${def.type}/${def.kind}`, err);
    return null;
  }
}
