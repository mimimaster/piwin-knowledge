/**
 * Lightweight zero-dependency token estimator for chunk sizing and context budgeting.
 * Counts CJK ideographs (~1.5 tokens) and ASCII/Latin runs (~4 chars/token) so the
 * bundled extension stays small and self-contained without a 5.5 MB BPE table.
 */
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/g;

export function countTokens(text: string): number {
  if (!text) return 0;
  const cjkMatches = text.match(CJK_RE);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjk = text.replace(CJK_RE, ' ');
  const nonCjkTokens = nonCjk.trim() ? Math.ceil(nonCjk.length / 4) : 0;
  return Math.ceil(cjkCount * 1.5) + nonCjkTokens;
}
