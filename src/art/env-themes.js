// The 18 themes: sky, lights, fog, surfaces, terrain, under-plane, backdrop, procedural decor tables, particles, gags.
// Colour language: bright warm path surfaces, decor slightly darker/cooler so the route always reads first.

// ---------------------------------------------------------------- prop palettes (shared by several themes)
export const PALS = {
  tropic: { leaf: [0x4fae4a, 0x6cc85a, 0x3f9a48], trunk: 0x8a6440, rock: 0xa8a08a, rockDark: 0x807a68, moss: 0x5aa048, flower: [0xe98c73, 0xffd76a, 0xf6a6c6, 0xfff7dc], sand: 0xf3dfa8, coconut: 0x6a4a2a, pine: 0x3f8a4a },
  jungle: { leaf: [0x3f9a48, 0x58b84a, 0x2f8040], trunk: 0x6a4a30, rock: 0x8a8a74, rockDark: 0x6a6a58, moss: 0x4f9a40, flower: [0xe98c73, 0xffd76a, 0xdbb2f6], sand: 0xd8c08a, coconut: 0x5a3a20, pine: 0x2f7a40 },
  sunset: { leaf: [0x4f9a58, 0x6ab45a, 0x3a8048], trunk: 0x7a5038, rock: 0xb08a7a, rockDark: 0x8a6a60, moss: 0x5a9a50, flower: [0xe98c73, 0xffc193, 0xdbb2f6], sand: 0xf6d2a8, coconut: 0x5a3a20, pine: 0x3f7a4a },
  desert: { leaf: [0x7aa050, 0x94b860, 0x5a8a40], trunk: 0xa07848, rock: 0xc8784a, rockDark: 0xa05a36, sand: 0xf2c886, cactus: 0x5a9a5a, flower: [0xf06ab8, 0xffd76a], walls: [0xe4b880, 0xd8a468, 0xecc898], archCol: 0xe2c08c, potCol: 0xc8703e },
  djinn: { leaf: [0x5a8a70, 0x6a9a7a, 0x4a7a60], trunk: 0x6a5048, rock: 0x8a5a7a, rockDark: 0x6a4060, sand: 0xc8a0a8, cactus: 0x4a7a6a, flower: [0xdbb2f6, 0xffd76a], walls: [0xb89ab8, 0xa888a8, 0xc8a8c0], archCol: 0xc8a8c8, potCol: 0x9a5a8a, lanternGlow: 0xdbb2f6 },
  sidibou: { leaf: [0x4f9a48, 0x62b052, 0x3f8a40], trunk: 0x8a6440, rock: 0xd8d0c0, rockDark: 0xb0a898, flower: [0xd94a9a, 0xf06ab8, 0xffd76a], sand: 0xf2e6c4, walls: [0xfbf8f0], archCol: 0xfbf8f0, domeCol: 0xfbf8f0, potCol: 0x2a6fd0 },
  ice: { leaf: [0x3f7a6a, 0x4f8a78, 0x2f6a5a], trunk: 0x5a4038, rock: 0xa8b8d0, rockDark: 0x7a8aa8, sand: 0xf4f8ff, pine: 0x2f6a5a, snowy: true, crystal: [0xbfe8ff, 0x9fd8f4, 0xdbb2f6] },
  aurora: { leaf: [0x2f5a6a, 0x3a6a78, 0x24505a], trunk: 0x3a3048, rock: 0x6a78a8, rockDark: 0x4a5888, sand: 0xe6eeff, pine: 0x24505a, snowy: true, crystal: [0xb5f3d0, 0xdbb2f6, 0x9fe8f0] },
  cave: { leaf: [0x4fb8a0, 0x3a9a88, 0x6ad0b8], trunk: 0x4a3a5a, rock: 0x6a5a8a, rockDark: 0x40365a, moss: 0x5ad0b0, crystal: [0xb88af0, 0x6ad8d0, 0xdbb2f6, 0xf6a6c6], flower: [0xb5f3d0, 0xdbb2f6] },
  factory: { leaf: [0x6a8a5a, 0x7a9a68, 0x5a7a4a], trunk: 0x5a4a3a, rock: 0x7a7480, rockDark: 0x5a5460, pipes: [0x387d76, 0xe98c73, 0x8a92a0, 0xedc371], gearCol: 0xa8a090, smoke: 0xb0a8b8, strutCol: 0x5a6270, fenceCol: 0x8a92a0 },
  lab: { leaf: [0x5aa080, 0x6ab090, 0x4a9070], trunk: 0x5a4a3a, rock: 0x8a9aa0, rockDark: 0x6a7a80, pipes: [0x99d1b7, 0xe4e8f0, 0x387d76], gearCol: 0xc0c8d0, smoke: 0xa8d0c0, strutCol: 0x6a7a88, fenceCol: 0xa8b0b8 },
  alarm: { leaf: [0x5a7060, 0x6a8070, 0x4a6050], trunk: 0x4a3a3a, rock: 0x6a5a68, rockDark: 0x4a3a48, pipes: [0xe94f4f, 0x6a6480, 0x8a92a0], gearCol: 0x9a9098, smoke: 0x6a5a6a, strutCol: 0x4a4458, fenceCol: 0x6a6480 },
  space: { leaf: [0x7ff0e0, 0xdbb2f6, 0x5ad0b0], trunk: 0x4a4478, rock: 0x9a92b8, rockDark: 0x6a6290, crystal: [0x7ff0e0, 0xdbb2f6, 0xb5f3d0], pipes: [0x8a86b0, 0x7ff0e0], strutCol: 0x5a5488 },
  tower: { leaf: [0x6a5a7a, 0x7a6a8a, 0x5a4a6a], trunk: 0x3a3048, rock: 0x5a546a, rockDark: 0x3a3448, pipes: [0xe98c73, 0x6a6480, 0x4a4460], smoke: 0x6a5a7a, strutCol: 0x3a3448, cloudCol: 0xb8a8d0, gearCol: 0x8a8098 },
  golden: { leaf: [0xedc371, 0xffd76a, 0xd8a848], trunk: 0xb08030, rock: 0xe8c070, rockDark: 0xc89a40, crystal: [0xffd76a, 0xdbb2f6, 0xfff7dc], flower: [0xdbb2f6, 0xfff7dc, 0xe98c73], cloudCol: 0xfff4d0, sand: 0xf0d080, moss: 0xffe08a, coconut: 0xe98c73, pine: 0xd8a848, strutCol: 0xb08030 },
};

// [kind, weight, scaleMin, scaleMax]
const BEACH_PROPS = {
  near: [['bush', 3, 0.8, 1.3], ['fern', 2, 0.8, 1.2], ['grass_tuft', 4, 0.8, 1.4], ['rock', 1.2, 0.5, 1.1], ['flowers', 1.5, 0.8, 1.2], ['shell', 0.5, 0.6, 1], ['pebbles', 1, 0.8, 1.2]],
  mid: [['palm', 7, 0.9, 1.25], ['bush', 2, 1, 1.6], ['rock', 1, 0.8, 1.6], ['umbrella', 0.5, 1, 1], ['deckchair', 0.35, 1, 1], ['tiki_torch', 0.6, 1, 1.1], ['fern', 2, 1, 1.5]],
  far: [['palm', 6, 1, 1.4], ['tree', 2.5, 1.2, 1.8], ['boulder', 1, 1, 2], ['hut', 0.4, 1, 1.2]],
  water: [['rock', 1, 0.8, 2]],
  landmarks: ['totem', 'hut', 'tiki_torch'],
};
const JUNGLE_PROPS = {
  near: [['fern', 5, 0.9, 1.5], ['bush', 3, 0.9, 1.4], ['grass_tuft', 4, 1, 1.5], ['mushroom', 1, 0.6, 1], ['flowers', 1.5, 0.9, 1.3], ['rock', 1, 0.6, 1.1], ['log', 0.4, 0.8, 1]],
  mid: [['tree', 6, 1, 1.5], ['palm', 2, 1, 1.3], ['fern', 3, 1.4, 2.2], ['mushroom', 1.2, 1, 1.8], ['bush', 2, 1.2, 2], ['tiki_torch', 0.4, 1, 1]],
  far: [['tree', 7, 1.3, 2.2], ['palm', 2, 1.2, 1.6], ['boulder', 1, 1.2, 2.5]],
  water: [['lilypad', 2, 0.8, 1.4], ['rock', 0.6, 0.8, 1.6]],
  landmarks: ['totem', 'mushroom', 'hut'],
};
const RIVER_PROPS = {
  near: [['reeds', 3, 0.8, 1.3], ['fern', 3, 0.9, 1.4], ['bush', 2, 0.9, 1.3], ['flowers', 2, 0.9, 1.3], ['grass_tuft', 4, 1, 1.4], ['rock', 1, 0.6, 1.1]],
  mid: [['tree', 5, 1, 1.5], ['palm', 2, 1, 1.3], ['bush', 2, 1.2, 1.8], ['log', 0.6, 1, 1.2], ['reeds', 1.5, 1, 1.4]],
  far: [['tree', 6, 1.3, 2], ['palm', 2, 1.1, 1.5]],
  water: [['lilypad', 4, 0.8, 1.5], ['reeds', 1, 0.8, 1.2], ['rock', 0.5, 0.8, 1.6]],
  landmarks: ['hut', 'totem'],
};
const DESERT_PROPS = {
  near: [['rock', 3, 0.5, 1.1], ['pebbles', 2, 0.8, 1.3], ['cactus', 1.5, 0.6, 0.9], ['grass_tuft', 1, 0.8, 1.2]],
  mid: [['cactus', 4, 0.9, 1.4], ['palm', 1.6, 0.9, 1.2], ['rock', 2, 1, 2], ['pot', 0.4, 1, 1.4]],
  far: [['boulder', 2, 1.5, 3], ['palm', 1.5, 1, 1.4], ['cactus', 2.5, 1.2, 1.8]],
  water: [['reeds', 1, 0.8, 1.2]],
  landmarks: ['camel_vacation', 'palm', 'pot'],
};
const MEDINA_PROPS = {
  near: [['pot', 2, 0.8, 1.3], ['lantern', 1.2, 1, 1.1], ['crate_pile', 0.3, 0.8, 1], ['barrel', 0.8, 0.9, 1.1], ['bougainvillea', 0.6, 0.6, 0.9]],
  mid: [['house', 7, 1, 1.4], ['arch', 0.8, 1, 1.2], ['palm', 1, 1, 1.3], ['dome', 0.6, 1, 1.3]],
  far: [['house', 5, 1.3, 2], ['minaret', 0.8, 1, 1.5], ['dome', 1, 1.2, 1.8]],
  water: [],
  landmarks: ['minaret', 'arch', 'dome'],
};
const SIDIBOU_PROPS = {
  near: [['pot', 2, 0.8, 1.3], ['bougainvillea', 2.5, 0.7, 1.1], ['lantern', 0.8, 1, 1], ['flowers', 1, 1, 1.3]],
  mid: [['house_blue', 7, 1, 1.4], ['bougainvillea', 2, 1.1, 1.6], ['palm', 1.2, 1, 1.3], ['dome', 0.5, 1, 1.3]],
  far: [['house_blue', 6, 1.3, 2], ['dome', 1, 1.2, 1.8], ['palm', 1, 1.2, 1.6]],
  water: [['rock', 1, 0.8, 1.8]],
  landmarks: ['cat_wall', 'dome', 'minaret'],
};
const ICE_PROPS = {
  near: [['rock', 2, 0.5, 1], ['ice_spike', 2, 0.5, 0.9], ['pebbles', 1, 0.8, 1.2], ['snowman', 0.25, 0.9, 1.1]],
  mid: [['pine', 6, 0.9, 1.4], ['ice_spike', 2.5, 0.9, 1.6], ['igloo', 0.4, 1, 1.2], ['boulder', 1, 0.8, 1.6]],
  far: [['pine', 7, 1.2, 2], ['ice_spike', 2, 1.5, 3], ['boulder', 1, 1.5, 3]],
  water: [['ice_spike', 1, 0.8, 1.4], ['rock', 1, 0.8, 1.6]],
  landmarks: ['igloo', 'snowman'],
};
const CAVE_PROPS = {
  near: [['crystal', 3, 0.6, 1.1], ['stalagmite', 2, 0.5, 0.9], ['rock', 2, 0.6, 1.1], ['mushroom', 1, 0.5, 0.8]],
  mid: [['stalagmite', 4, 1, 1.8], ['crystal', 3, 1.2, 2], ['boulder', 1, 1, 1.8], ['mushroom', 1, 1, 1.6]],
  far: [['stalagmite', 6, 1.6, 3], ['crystal', 2, 2, 3.5]],
  water: [['crystal', 1, 0.8, 1.4]],
  landmarks: ['crystal'],
};
const AURORA_PROPS = {
  near: [['ice_spike', 2, 0.5, 1], ['rock', 2, 0.5, 1], ['crystal', 1.2, 0.6, 1], ['aurora_tree', 1, 0.7, 1]],
  mid: [['pine', 5, 0.9, 1.4], ['aurora_tree', 2.5, 1, 1.5], ['ice_spike', 2, 1, 1.8], ['igloo', 0.3, 1, 1.2]],
  far: [['pine', 6, 1.2, 2], ['ice_spike', 2, 1.6, 3]],
  water: [['ice_spike', 1, 0.8, 1.4]],
  landmarks: ['igloo', 'aurora_tree'],
};
const FACTORY_PROPS = {
  near: [['barrel', 3, 0.9, 1.1], ['crate_pile', 1, 0.8, 1], ['pipe', 0.8, 0.6, 0.8], ['gear', 0.5, 0.5, 0.7]],
  mid: [['pipe', 3, 0.9, 1.3], ['tank', 2, 1, 1.4], ['gear', 1.5, 1, 1.5], ['robot_arm', 1, 1, 1.3], ['chimney', 0.6, 0.8, 1]],
  far: [['chimney', 3, 1, 1.5], ['tank', 2, 1.5, 2.2], ['pipe', 2, 1.4, 2]],
  water: [['barrel', 1, 0.9, 1.1]],
  landmarks: ['robot_arm', 'chimney'],
};
const LAB_PROPS = {
  near: [['barrel', 2, 0.9, 1.1], ['tube', 2, 0.7, 1], ['crate_pile', 1, 0.8, 1]],
  mid: [['tube', 3, 1, 1.5], ['tank', 2, 1, 1.4], ['pipe', 2, 0.9, 1.3], ['satellite', 1, 1, 1.3], ['robot_arm', 0.6, 1, 1.2]],
  far: [['tank', 2, 1.5, 2.2], ['chimney', 1, 1, 1.4], ['satellite', 2, 1.4, 2]],
  water: [['barrel', 1, 0.9, 1.1]],
  landmarks: ['tube', 'satellite'],
};
const SPACE_PROPS = {
  near: [['rock', 3, 0.5, 1.2], ['crystal', 2, 0.6, 1], ['pebbles', 2, 1, 1.4]],
  mid: [['rock', 2, 1.4, 2.8], ['crystal', 2, 1, 1.6], ['satellite', 1, 1, 1.3], ['ufo', 0.3, 1, 1.2]],
  far: [['boulder', 3, 1.5, 3.5], ['crystal', 2, 2, 3], ['planet', 0.3, 1, 2]],
  water: [],
  landmarks: ['satellite', 'ufo'],
};
const TOWER_PROPS = {
  near: [['barrel', 2, 0.9, 1.1], ['crate_pile', 1, 0.8, 1], ['flag', 0.6, 0.8, 1]],
  mid: [['pipe', 2, 1, 1.4], ['gear', 1, 1, 1.4], ['tank', 1, 1, 1.3], ['satellite', 0.8, 1, 1.2], ['flag', 1, 1, 1.3]],
  far: [['cloud_puff', 4, 3, 6], ['gear', 0.6, 2, 3]],
  water: [],
  landmarks: ['robot_arm', 'gear'],
};
const GOLDEN_PROPS = {
  near: [['crystal', 2, 0.6, 1], ['flowers', 2, 1, 1.4], ['bush', 2, 0.8, 1.2], ['grass_tuft', 2, 1, 1.4], ['rock', 1, 0.6, 1]],
  mid: [['palm', 4, 1, 1.3], ['crystal', 2.5, 1, 1.8], ['mushroom', 1, 1, 1.5], ['statue_sock', 0.25, 0.9, 1.1], ['tree', 1.5, 1, 1.4]],
  far: [['palm', 3, 1.2, 1.7], ['crystal', 3, 2, 3.5], ['tree', 2, 1.4, 2]],
  water: [],
  landmarks: ['statue_sock', 'planet'],
};

// ---------------------------------------------------------------- themes
// sky = [top, mid, horizon, below]; fog = [near, far]; under = plane below the level (water/lava/goo/sand/cloud/void)
// terrain: shelf = drop below path for the side banks; hillL/hillR = hill heights (left/right of the route);
// sea = side (-1 left / 1 right) where the land slopes into the sea; colours: grass/shore/cliff/high
export const THEMES = {
  beach: {
    sky: [0x2f8fe0, 0x86d0f2, 0xfff0d2, 0xbfe8e6], sunDir: [0.45, 0.62, 0.55], sunCol: 0xfff3dc, sunSize: 1.2,
    sun: [0xfff1d8, 2.7], hemi: [0xd6f2ff, 0xd8c08a, 1.3], fog: [60, 230], exposure: 1.06,
    clouds: { n: 16, color: 0xffffff, shade: 0xa8c8e0 },
    under: { type: 'water', deep: 0x0f86c8, shallow: 0x3fe0d2, foam: 0xffffff }, support: 'pillar',
    ground: 'sand_beach', kinds: { grass: 'grass', stone: 'stone_mossy' },
    terrain: { shelf: 2.0, hillL: 3, hillR: 12, sea: -1, grass: 0x78c24e, shore: 0xf3dfa8, cliff: 0xc9a070, high: 0x5aa448 },
    backdrop: { type: 'islands', cols: [0x4f9a6a, 0x78b8a0, 0xa8d8d0] },
    pal: 'tropic', props: BEACH_PROPS, particles: null,
    gags: ['notcrash', 'sunscreen', 'nobandicoot', 'lawyers'],
  },
  jungle: {
    sky: [0x4f9e9a, 0x9fd4b8, 0xf6f2c8, 0xc8d5a0], sunDir: [-0.4, 0.7, 0.5], sunCol: 0xfff2c0, sunSize: 1,
    sun: [0xfff0c8, 2.5], hemi: [0xe4f6dc, 0x4f7a48, 1.35], fog: [40, 170], fogCol: 0xc8e4c0, exposure: 1.05,
    clouds: { n: 10, color: 0xf6fbf2, shade: 0xb8d0c0 },
    under: { type: 'water', deep: 0x1f6f68, shallow: 0x5cc0a0, foam: 0xe8fff0 }, support: 'pillar',
    ground: 'grass_jungle', kinds: { grass: 'grass_jungle', stone: 'stone_mossy' },
    terrain: { shelf: 1.6, hillL: 14, hillR: 14, sea: 0, grass: 0x4f9e44, shore: 0x8a7a50, cliff: 0x7a6a4a, high: 0x3f8a40 },
    backdrop: { type: 'ridges', cols: [0x3f7a5a, 0x6a9e84, 0x9ec4ae] },
    pal: 'jungle', props: JUNGLE_PROPS, particles: { type: 'fireflies', color: 0xfff2a0, n: 120 },
    gags: ['nobandicoot', 'moonroll', 'jungletm', 'okutips'],
  },
  river: {
    sky: [0x6a9ad8, 0xf0c8b0, 0xffe2b8, 0xf0d0b0], sunDir: [0.5, 0.35, -0.8], sunCol: 0xfff0c8, sunSize: 1.4,
    sun: [0xffd8a8, 2.5], hemi: [0xffe8d8, 0x6a8a58, 1.3], fog: [50, 200], exposure: 1.05,
    clouds: { n: 14, color: 0xfff0e6, shade: 0xe0a0a0 },
    under: { type: 'water', deep: 0x2a7f88, shallow: 0x6cd4c0, foam: 0xffffff }, support: 'pillar',
    ground: 'grass', kinds: { stone: 'stone_mossy' },
    terrain: { shelf: 1.0, hillL: 10, hillR: 10, sea: 0, channel: 7, grass: 0x6ab84a, shore: 0xd8c090, cliff: 0x9a7a58, high: 0x4f9a44 },
    backdrop: { type: 'hills', cols: [0x5f9c86, 0x8ab8a4, 0xc0d4c4] },
    pal: 'tropic', props: RIVER_PROPS, particles: { type: 'fireflies', color: 0xffe0a0, n: 90 },
    gags: ['lilypads', 'noswim', 'notcrash'],
  },
  desert: {
    sky: [0x4f74c8, 0xf0b48e, 0xffe2b4, 0xf0c896], sunDir: [0.3, 0.5, -0.8], sunCol: 0xfff0c8, sunSize: 1.6,
    sun: [0xffd8a0, 2.8], hemi: [0xffe2c0, 0xc08a5a, 1.25], fog: [70, 260], exposure: 1.04,
    clouds: { n: 6, color: 0xffe6d0, shade: 0xe08a8a },
    under: { type: 'sand', c1: 0xe8b070, c2: 0xd08a50, c3: 0xf6d098 }, support: 'pillar',
    ground: 'sand_desert', kinds: { sand: 'sand_desert', stone: 'stone_sand', grass: 'grass_dry', tile: 'tile_terracotta' },
    terrain: { shelf: 2.2, hillL: 9, hillR: 9, sea: 0, grass: 0xe8b878, shore: 0xe0a868, cliff: 0xc0703e, high: 0xf0c888, dunes: true },
    backdrop: { type: 'dunes', cols: [0xd9905c, 0xe8b07a, 0xf4cfa0] },
    pal: 'desert', props: DESERT_PROPS, particles: { type: 'dust', color: 0xffe0b0, n: 80 },
    gags: ['camel', 'mirage', 'tozeur', 'notcrash'],
  },
  medina: {
    sky: [0x3a8ad6, 0x9ed2ea, 0xfff6e2, 0xcfe8ee], sunDir: [-0.4, 0.7, 0.55], sunCol: 0xfffbe8, sunSize: 1,
    sun: [0xfff2dc, 2.7], hemi: [0xe2f2ff, 0xc8a878, 1.3], fog: [60, 220], exposure: 1.04,
    clouds: { n: 8, color: 0xffffff, shade: 0xaac0d4 },
    under: { type: 'sand', c1: 0xd8b080, c2: 0xb88a5a, c3: 0xe8c898 }, support: 'pillar',
    ground: 'tile_zellige', kinds: { stone: 'stone_sand', sand: 'sand_desert', tile: 'tile_zellige', grass: 'grass_dry' },
    terrain: { shelf: 1.0, hillL: 6, hillR: 6, sea: 0, grass: 0xd8b07a, shore: 0xc89a68, cliff: 0xc08a58, high: 0xe0bc88 },
    backdrop: { type: 'medina', cols: [0xd8a878, 0xe4c098, 0xf0dcc0] },
    pal: 'desert', props: MEDINA_PROPS, particles: { type: 'dust', color: 0xfff0d0, n: 60 },
    gags: ['cortisol', 'carpets', 'sales', 'nobandicoot'],
  },
  sidibou: {
    sky: [0x1f6fd8, 0x7ec4f0, 0xf4fbff, 0xc8e8f8], sunDir: [0.5, 0.7, 0.45], sunCol: 0xffffff, sunSize: 1.1,
    sun: [0xfff6e8, 2.8], hemi: [0xe2f2ff, 0xb8c8c0, 1.35], fog: [70, 250], exposure: 1.02,
    clouds: { n: 12, color: 0xffffff, shade: 0x9ac0e0 },
    under: { type: 'water', deep: 0x0a4fb0, shallow: 0x2ab8e0, foam: 0xffffff }, support: 'pillar',
    ground: 'whitewash', kinds: { stone: 'whitewash', tile: 'tile_zellige', grass: 'grass' },
    terrain: { shelf: 1.6, hillL: 4, hillR: 14, sea: -1, grass: 0x8ab860, shore: 0xf2e6c4, cliff: 0xc8b8a0, high: 0x7aa858 },
    backdrop: { type: 'sidibou', cols: [0xc8d8e8, 0xdce8f0, 0xeef4f8] },
    pal: 'sidibou', props: SIDIBOU_PROPS, particles: { type: 'petals', color: 0xf06ab8, n: 50 },
    gags: ['catnap', 'bluepaint', 'cafe', 'cortisol'],
  },
  ice: {
    sky: [0x6aa8e0, 0xbfe0f6, 0xfff2f0, 0xd8e8f8], sunDir: [0.4, 0.38, -0.8], sunCol: 0xfff4f0, sunSize: 1.2,
    sun: [0xfff0f0, 2.4], hemi: [0xdcecff, 0xa8b8d8, 1.45], fog: [50, 210], fogCol: 0xe6f0fc, exposure: 1.0,
    clouds: { n: 12, color: 0xffffff, shade: 0xb8c8e8 },
    under: { type: 'ice', deep: 0x3a78b8, shallow: 0x9adcf2, foam: 0xffffff }, support: 'pillar',
    ground: 'snow', kinds: { stone: 'stone_ice', grass: 'snow', wood: 'wood_pale' },
    terrain: { shelf: 1.8, hillL: 12, hillR: 12, sea: 0, grass: 0xc4d4ea, shore: 0xa8c0e0, cliff: 0x7a90bc, high: 0xe4ecf8 },
    backdrop: { type: 'peaks', cols: [0x6a80b0, 0x9ab0d8, 0xf4f8ff] },
    pal: 'ice', props: ICE_PROPS, particles: { type: 'snow', color: 0xffffff, n: 260 },
    gags: ['penguins', 'slide', 'yeti'],
  },
  cave: {
    sky: [0x140f30, 0x2a2058, 0x3a5a78, 0x1c1640], sunDir: [0.3, 0.8, 0.4], sunCol: 0x8ad8d0, sunSize: 0, stars: 0.9, glowworms: 1,
    sun: [0xc8b8ff, 2.0], hemi: [0xa8b4f0, 0x5a4a8a, 2.2], fog: [30, 130], fogCol: 0x2a3058, exposure: 1.2,
    clouds: null,
    under: { type: 'water', deep: 0x0a3a4a, shallow: 0x2ab8b0, foam: 0x9ff0e0, glow: 1 }, support: 'pillar',
    ground: 'stone_cave', kinds: { stone: 'stone_cave', grass: 'grass_night', ice: 'ice' },
    terrain: { shelf: 1.6, hillL: 16, hillR: 16, sea: 0, grass: 0x5a4a7a, shore: 0x3a6a78, cliff: 0x40365a, high: 0x6a5a8a, ceiling: true },
    backdrop: { type: 'cave', cols: [0x2a2048, 0x3a2e60, 0x4a3e78] },
    pal: 'cave', props: CAVE_PROPS, particles: { type: 'motes', color: 0x9ff0e0, n: 140 },
    gags: ['crystals', 'nobandicoot', 'echo'],
  },
  aurora: {
    sky: [0x0e1438, 0x22386e, 0x5a7ab8, 0x1c2450], sunDir: [-0.3, 0.45, -0.85], sunCol: 0xf4f8ff, sunSize: 1.2, moon: true, stars: 1, aurora: 1,
    sun: [0xb8ccff, 1.6], hemi: [0x9ab8f0, 0x5a6aa0, 1.7], fog: [60, 230], fogCol: 0x34507e, exposure: 1.15,
    clouds: null,
    under: { type: 'ice', deep: 0x1a3060, shallow: 0x5a88c8, foam: 0xd8f0ff }, support: 'float',
    ground: 'snow_night', kinds: { snow: 'snow_night', stone: 'stone_ice', grass: 'grass_night' },
    terrain: { shelf: 2.5, hillL: 10, hillR: 10, sea: 0, grass: 0xc8d4f4, shore: 0x8a9ad0, cliff: 0x4a5888, high: 0xe6eeff },
    backdrop: { type: 'peaks', cols: [0x2a3a6a, 0x4a5a8a, 0xc8d4f4] },
    pal: 'aurora', props: AURORA_PROPS, particles: { type: 'snow', color: 0xdfe8ff, n: 120 },
    gags: ['aurora_trial', 'penguins'],
  },
  factory: {
    sky: [0x5a4a7a, 0xc88a8a, 0xf6c8a0, 0x6a5a6a], sunDir: [0.4, 0.55, -0.7], sunCol: 0xffd0a0, sunSize: 1.5,
    sun: [0xffd0b0, 2.4], hemi: [0xf0d8e8, 0x6a5a68, 1.45], fog: [45, 190], fogCol: 0xd8a8a0, exposure: 1.05,
    clouds: { n: 10, color: 0xc8a8b0, shade: 0x6a5a6a },
    under: { type: 'goo', deep: 0x2a8a3a, shallow: 0x8af06a, foam: 0xd8ff9a }, support: 'strut',
    ground: 'metal', kinds: { stone: 'stone_dark', grass: 'grass_dry', tile: 'tile_lab' },
    terrain: null,
    backdrop: { type: 'factory', cols: [0x6a5470, 0x8a6a80, 0xb08a90] },
    pal: 'factory', props: FACTORY_PROPS, particles: { type: 'sparks', color: 0xffb060, n: 70 }, floating: false, industrial: true,
    gags: ['cortisol', 'accidents', 'stressotron', 'nobandicoot'],
  },
  lab: {
    sky: [0x1a2a48, 0x2a5a6a, 0x6ac0b0, 0x1a3040], sunDir: [0.3, 0.7, 0.6], sunCol: 0xc8fff0, sunSize: 0.8, stars: 0.5,
    sun: [0xd8fff4, 2.0], hemi: [0xc8f0e8, 0x3a5a5a, 1.6], fog: [40, 170], fogCol: 0x3a7a7a, exposure: 1.1,
    clouds: null,
    under: { type: 'goo', deep: 0x1a6a4a, shallow: 0x6af0a0, foam: 0xe0ffd0 }, support: 'strut',
    ground: 'tile_lab', kinds: { stone: 'stone_dark', metal: 'metal', tile: 'tile_lab' },
    terrain: null,
    backdrop: { type: 'lab', cols: [0x1f4a50, 0x2f6a70, 0x4a8a88] },
    pal: 'lab', props: LAB_PROPS, particles: { type: 'bubbles', color: 0x9af0c0, n: 90 }, industrial: true,
    gags: ['labban', 'redbutton', 'cortisol', 'rats'],
  },
  space: {
    sky: [0x06041a, 0x1c1650, 0x5a3a8a, 0x0a0820], sunDir: [0.5, 0.4, -0.75], sunCol: 0xfff7dc, sunSize: 1.4, stars: 1.6, nebula: 1,
    sun: [0xfff4e8, 2.4], hemi: [0xb8a8f0, 0x3a3070, 1.6], fog: [80, 300], fogCol: 0x2a1f58, exposure: 1.12,
    clouds: null,
    under: { type: 'void' }, support: 'float',
    ground: 'panel_space', kinds: { stone: 'moon', sand: 'moon', grass: 'moon', metal: 'panel_space' },
    terrain: null, floating: true,
    backdrop: { type: 'space', cols: [0xe98c73, 0x99d1b7, 0xdbb2f6] },
    pal: 'space', props: SPACE_PROPS, particles: { type: 'stardust', color: 0xdbb2f6, n: 120 },
    gags: ['cardboard', 'spacestress', 'cortisol'],
  },
  tower: {
    sky: [0x24143a, 0x6a2a5a, 0xe86a5a, 0x2a1a3a], sunDir: [-0.5, 0.3, -0.8], sunCol: 0xffb080, sunSize: 1.8,
    sun: [0xffc0a0, 2.2], hemi: [0xd8a8d8, 0x4a3050, 1.6], fog: [60, 240], fogCol: 0x8a4a6a, exposure: 1.1,
    clouds: { n: 16, color: 0xb88aa8, shade: 0x4a2a4a },
    under: { type: 'cloud', c1: 0xb890b8, c2: 0x6a4a78, c3: 0xe8b0c0 }, support: 'strut',
    ground: 'metal_dark', kinds: { stone: 'stone_dark', metal: 'metal_dark', brick: 'brick' },
    terrain: null, floating: true,
    backdrop: { type: 'tower', cols: [0x3a2040, 0x5a3058, 0x8a4a6a] },
    pal: 'tower', props: TOWER_PROPS, particles: { type: 'embers', color: 0xff8a6a, n: 80 }, industrial: true, density: 0.6, deckStyle: 'brick',
    gags: ['stresstower', 'elevator', 'cortisol'],
  },
  boss_beach: {
    sky: [0x4a5aa8, 0xe8908a, 0xffd0a0, 0xf0b0a0], sunDir: [0.0, 0.18, -1], sunCol: 0xffe0a0, sunSize: 3,
    sun: [0xffc8a0, 2.4], hemi: [0xffd8d0, 0x8a7060, 1.4], fog: [70, 240], exposure: 1.06,
    clouds: { n: 14, color: 0xffd8c8, shade: 0xc06a80 },
    under: { type: 'water', deep: 0x2a5a9a, shallow: 0x6ac8c8, foam: 0xfff0e0 }, support: 'pillar',
    ground: 'sand_beach', kinds: { grass: 'grass', stone: 'stone_mossy' },
    terrain: { shelf: 2.0, hillL: 4, hillR: 10, sea: -1, grass: 0x6aa850, shore: 0xf6d2a8, cliff: 0xb08a6a, high: 0x5a9a48 },
    backdrop: { type: 'islands', cols: [0x6a5a7a, 0x9a7a90, 0xc89aa0] },
    pal: 'sunset', props: BEACH_PROPS, particles: null,
    gags: ['crabking', 'arena', 'notcrash'],
  },
  boss_desert: {
    sky: [0x140c38, 0x3a2a78, 0xa86ab0, 0x2a1a48], sunDir: [-0.35, 0.5, -0.8], sunCol: 0xfff0d8, sunSize: 1.6, moon: true, stars: 1.2,
    sun: [0xd8b8ff, 1.9], hemi: [0xc8a8f0, 0x6a4a6a, 1.6], fog: [60, 230], fogCol: 0x5a3a7a, exposure: 1.14,
    clouds: null,
    under: { type: 'sand', c1: 0x8a6a8a, c2: 0x6a4a6a, c3: 0xa888a8 }, support: 'pillar',
    ground: 'tile_zellige', kinds: { sand: 'sand_desert', stone: 'stone_sand' },
    terrain: { shelf: 2.0, hillL: 8, hillR: 8, sea: 0, grass: 0xb890a8, shore: 0x9a7090, cliff: 0x7a5070, high: 0xc8a0b8, dunes: true },
    backdrop: { type: 'dunes', cols: [0x5a3a6a, 0x7a5080, 0x9a70a0] },
    pal: 'djinn', props: { ...DESERT_PROPS, mid: [...DESERT_PROPS.mid, ['lantern', 1.5, 1, 1.2]] }, particles: { type: 'sparkles', color: 0xdbb2f6, n: 90 },
    gags: ['djinn', 'arena', 'camel'],
  },
  boss_ice: {
    sky: [0x8aa8d0, 0xc8d8ec, 0xeef4fc, 0xd8e4f4], sunDir: [0.3, 0.5, -0.8], sunCol: 0xffffff, sunSize: 0.8,
    sun: [0xf0f4ff, 2.0], hemi: [0xe8f0ff, 0xa8b8d8, 1.6], fog: [30, 140], fogCol: 0xe0eaf6, exposure: 1.02,
    clouds: { n: 10, color: 0xf0f4fc, shade: 0xb0c0dc },
    under: { type: 'ice', deep: 0x4a78b0, shallow: 0xaadcf0, foam: 0xffffff }, support: 'pillar',
    ground: 'ice', kinds: { stone: 'stone_ice', grass: 'snow' },
    terrain: { shelf: 1.8, hillL: 12, hillR: 12, sea: 0, grass: 0xf0f6ff, shore: 0xc8dcf0, cliff: 0x8aa0c8, high: 0xffffff },
    backdrop: { type: 'peaks', cols: [0x8a9cc0, 0xb0c0e0, 0xf4f8ff] },
    pal: 'ice', props: ICE_PROPS, particles: { type: 'blizzard', color: 0xffffff, n: 420 },
    gags: ['yeti', 'arena', 'penguins'],
  },
  boss_lab: {
    sky: [0x1a0c20, 0x5a1a2a, 0xc04a4a, 0x200a14], sunDir: [0.3, 0.7, 0.6], sunCol: 0xff8a7a, sunSize: 0.6, stars: 0.4,
    sun: [0xffb0a0, 2.0], hemi: [0xf0a8b0, 0x3a2030, 1.6], fog: [40, 170], fogCol: 0x5a1a2a, exposure: 1.1,
    clouds: null,
    under: { type: 'lava', deep: 0xc02a10, shallow: 0xffa030, foam: 0xfff0a0 }, support: 'strut',
    ground: 'metal_dark', kinds: { metal: 'metal_dark', stone: 'stone_dark', tile: 'tile_lab' },
    terrain: null,
    backdrop: { type: 'factory', cols: [0x3a1a2a, 0x5a2a3a, 0x7a3a48] },
    pal: 'alarm', props: LAB_PROPS, particles: { type: 'embers', color: 0xff6a4a, n: 90 }, industrial: true, alarm: true,
    gags: ['finalboss', 'cortisol', 'stressotron'],
  },
  golden: {
    sky: [0x6a4a9a, 0xe8a8c8, 0xffe8a8, 0xf0c890], sunDir: [0.4, 0.5, -0.75], sunCol: 0xfff0b0, sunSize: 2.2, moon: true, stars: 0.6,
    sun: [0xffe8b0, 2.6], hemi: [0xfff0d0, 0xc89a50, 1.5], fog: [70, 260], fogCol: 0xf6d0b0, exposure: 1.06,
    clouds: { n: 14, color: 0xfff0d0, shade: 0xe0a0c0 },
    under: { type: 'cloud', c1: 0xfff0c0, c2: 0xe8b8d0, c3: 0xfff8e8 }, support: 'float',
    ground: 'gold', kinds: { cloud: 'cloud_gold', grass: 'grass', stone: 'gold', sand: 'sand_beach' },
    terrain: { shelf: 2.0, hillL: 6, hillR: 6, sea: 0, grass: 0xedc371, shore: 0xf0d080, cliff: 0xc89a40, high: 0xffe08a, island: true },
    backdrop: { type: 'golden', cols: [0xd8a060, 0xe8b880, 0xf6d8a8] },
    pal: 'golden', props: GOLDEN_PROPS, particles: { type: 'sparkles', color: 0xffe08a, n: 120 },
    gags: ['goldnotcrash', 'socks', 'cortisol'],
  },
};

export const DEFAULT_KINDS = {
  grass: 'grass', sand: 'sand_beach', stone: 'stone', wood: 'wood', metal: 'metal', ice: 'ice', tile: 'tile_terracotta',
  brick: 'brick', crystal: 'crystal', cloud: 'cloud', conveyor: 'conveyor', glass: 'glass', lava_rock: 'lava_rock',
  snow: 'snow', bridge: 'bridge',
};

export function getTheme(id) { return THEMES[id] || THEMES.beach; }
