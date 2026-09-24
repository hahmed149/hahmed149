// Branch colours, like a git graph. Main-road roles tint the main road.
export const BRANCH = {
  main: '#dbe7ff',
  ksu: '#a78bfa', collegian: '#ffb454', softek: '#7ee787', cerner: '#4fc3f7', rxss: '#2ee6b6',
  fluxpilot: '#38bdf8', annovox: '#ff6bcb', nac: '#c792ea', addi: '#ff7b72', oneimaging: '#5aa9ff', chicago: '#ffd166',
};
export const GOLD = '#ffd166';

// Short, stable commit hash from text (FNV-1a)
export function hash7(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7);
}
