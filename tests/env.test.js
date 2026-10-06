// Environment data sanity (pure Node, no DOM): every theme is complete, every platform kind maps to a surface
// style, every decor kind referenced by themes / gags exists and its template builds, gag texts are bilingual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, PALS, DEFAULT_KINDS } from '../src/art/env-themes.js';
import { getTemplate, resolveKind, PROP_KINDS } from '../src/art/env-props.js';
import { GAGS, gagSpec } from '../src/art/env-gags.js';
import { STYLES } from '../src/art/env-textures.js';

const ALL_THEMES = ['beach', 'jungle', 'river', 'desert', 'medina', 'sidibou', 'ice', 'cave', 'aurora', 'factory', 'lab',
  'space', 'tower', 'boss_beach', 'boss_desert', 'boss_ice', 'boss_lab', 'golden'];
const PLATFORM_KINDS = ['ground', 'grass', 'sand', 'stone', 'wood', 'metal', 'ice', 'tile', 'brick', 'crystal', 'cloud',
  'conveyor', 'glass', 'lava_rock', 'snow', 'bridge'];
const STYLE_IDS = Object.keys(STYLES);

test('every theme exists and is complete', () => {
  for (const id of ALL_THEMES) {
    const th = THEMES[id];
    assert.ok(th, `theme ${id}`);
    assert.equal(th.sky.length, 4, `${id} sky`);
    assert.ok(th.sun && th.hemi && th.fog, `${id} lights/fog`);
    assert.ok(PALS[th.pal], `${id} palette ${th.pal}`);
    assert.ok(STYLE_IDS.includes(th.ground), `${id} ground style ${th.ground}`);
    for (const [k, s] of Object.entries(th.kinds || {})) assert.ok(STYLE_IDS.includes(s), `${id}.${k} → ${s}`);
    if (th.deckStyle) assert.ok(STYLE_IDS.includes(th.deckStyle), `${id} deck style`);
    for (const g of th.gags || []) assert.ok(GAGS[g], `${id} gag ${g}`);
  }
});

test('every platform kind maps to a style in every theme', () => {
  for (const id of ALL_THEMES) {
    const th = THEMES[id];
    for (const k of PLATFORM_KINDS) {
      const s = k === 'ground' ? th.ground : th.kinds?.[k] ?? DEFAULT_KINDS[k];
      assert.ok(STYLE_IDS.includes(s), `${id}/${k} → ${s}`);
    }
  }
});

test('decor kinds used by the themes resolve and build (full + LOD)', () => {
  for (const id of ALL_THEMES) {
    const th = THEMES[id];
    const lists = [th.props.near, th.props.mid, th.props.far, th.props.water || []];
    const kinds = new Set([...lists.flat().map((it) => it[0]), ...(th.props.landmarks || [])]);
    for (const k of kinds) {
      assert.ok(resolveKind(k), `${id}: unknown decor ${k}`);
      for (const lod of [0, 1]) {
        const t = getTemplate(k, PALS[th.pal], th.pal, 0, lod);
        assert.ok(t && (t.lit || t.glow), `${id}: ${k} builds`);
        const n = (t.lit?.count || 0) + (t.glow?.count || 0);
        assert.ok(n > 0 && n < 3000, `${k} vertex budget (${n})`);
        for (const v of t.lit?.pos || []) assert.ok(Number.isFinite(v), `${k} finite positions`);
      }
    }
  }
});

test('every documented decor kind builds with every palette', () => {
  for (const k of PROP_KINDS) for (const [pid, pal] of Object.entries(PALS)) assert.ok(getTemplate(k, pal, pid, 1), `${k}/${pid}`);
  for (const alias of ['palm_tree', 'camel', 'house_white', 'tower', 'stone', 'sock_statue']) assert.ok(resolveKind(alias), alias);
  assert.equal(resolveKind('definitely_not_a_prop'), null);
});

test('gags are bilingual and produce a text spec', () => {
  for (const [id, g] of Object.entries(GAGS)) {
    assert.ok(Array.isArray(g.fr) && g.fr.length >= 2 && Array.isArray(g.en) && g.en.length >= 2, id);
    assert.ok(g.type === 'billboard' || g.type === 'poster', id);
    const s = gagSpec(id, 'en');
    assert.equal(s.title, g.en[0]);
    if (g.extra) assert.ok(resolveKind(g.extra), `${id} extra ${g.extra}`);
  }
});
