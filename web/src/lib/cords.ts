export const CORD_COLORS = ['red', 'amber', 'blue', 'green', 'violet'] as const;

export type CordColor = (typeof CORD_COLORS)[number];

export const cordFor = (id: string): CordColor => {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return CORD_COLORS[hash % CORD_COLORS.length]!;
};
