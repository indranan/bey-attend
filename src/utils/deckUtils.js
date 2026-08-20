const PART_TYPE_ALIASES = {
  'BLADE': 'BLADE',
  'MAIN BLADE': 'BLADE',
  'METAL BLADE': 'BLADE',
  'OVER BLADE': 'OVER_BLADE',
  'OVER_BLADE': 'OVER_BLADE',
  'ASSIST': 'ASSIST_BLADE',
  'ASSIST BLADE': 'ASSIST_BLADE',
  'ASSIST_BLADE': 'ASSIST_BLADE',
  'LOCK CHIP': 'LOCK_CHIP',
  'LOCK_CHIP': 'LOCK_CHIP',
  'RATCHET': 'RATCHET',
  'BIT': 'BIT',
};

export const normalizePartType = (type) => {
  const key = String(type || '').trim().toUpperCase();
  return PART_TYPE_ALIASES[key] || key;
};

const PART_TYPE_TO_FOLDER = {
  BLADE: 'blade',
  OVER_BLADE: 'over-blade',
  ASSIST_BLADE: 'assist-blade',
  LOCK_CHIP: 'lock-chip',
  RATCHET: 'ratchet',
  BIT: 'bit',
};

const PART_IMAGE_GLOB = import.meta.glob('../assets/beyblade/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const PART_IMAGE_GLOB_LOWERCASE = Object.fromEntries(
  Object.entries(PART_IMAGE_GLOB).map(([key, url]) => [key.toLowerCase(), url])
);

export const getPartImage = (part) => {
  if (!part?.partId) return '';
  const type = normalizePartType(part.partType);
  const folder = PART_TYPE_TO_FOLDER[type];
  if (!folder) return '';

  const candidates = [
    `../assets/beyblade/${folder}/${part.partId}.png`,
    `../assets/beyblade/${folder}/${String(part.partId).toUpperCase()}.png`,
  ];

  if (part.name) {
    candidates.push(`../assets/beyblade/${folder}/${String(part.name).toLowerCase()}.png`);
  }

  for (const key of candidates) {
    const found = PART_IMAGE_GLOB_LOWERCASE[key.toLowerCase()];
    if (found) return found;
  }
  return '';
};


export const isTrue = (value) => {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'y'].includes(
    String(value ?? '').trim().toLowerCase()
  );
};

export const getBladeRules = (part) => ({
  hasOverBlade: isTrue(part?.hasOverBlade ?? part?.has_over_blade),
  integratedRatchet: isTrue(
    part?.integratedRatchet ?? part?.integrated_ratchet
  ),
  integratedRatchetBit: isTrue(
    part?.integratedRatchetBit ?? part?.integrated_ratchet_bit
  ),
});

export const getDeckParts = (deck) => {
  if (!deck) return [];
  return [
    ['Lock Chip', deck.lockChip],
    ['Blade', deck.blade],
    ['Over Blade', deck.overBlade],
    ['Assist Blade', deck.assistBlade],
    ['Ratchet', deck.ratchet],
    ['Bit', deck.bit],
  ].filter(([, part]) => part && part.partId);
};

export const getComboName = (deck) => {
  if (!deck) return '';
  return getDeckParts(deck)
    .map(([, part]) => part?.name || '')
    .filter(Boolean)
    .join(' ');
};

export const getPartFieldKey = (type) => {
  switch (normalizePartType(type)) {
    case 'LOCK_CHIP': return 'lockChip';
    case 'BLADE': return 'blade';
    case 'OVER_BLADE': return 'overBlade';
    case 'ASSIST_BLADE': return 'assistBlade';
    case 'RATCHET': return 'ratchet';
    case 'BIT': return 'bit';
    default: return '';
  }
};
