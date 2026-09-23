import type { Citation } from "./chat-api";

/**
 * The model is told to cite with inline `[Source N]` markers, where N is the
 * 1-based position of a retrieved chunk. The API returns `citations` in that
 * same order, so `citations[N - 1]` is the source a marker refers to.
 *
 * Several chunks can come from one article, so the *footer* chips group by
 * article — but each group must remember every N it covers. (Numbering chips
 * by their position after de-duplication, as the UI used to, makes chip "2"
 * disagree with an inline "[Source 3]".)
 */

export interface CitationGroup {
  key: string;
  citation: Citation;
  /** Every source number (1-based) that maps to this article. */
  numbers: number[];
}

export function groupCitations(citations: Citation[]): CitationGroup[] {
  const groups = new Map<string, CitationGroup>();
  citations.forEach((c, i) => {
    const key = c.slug ?? c.title ?? c.chunk_id;
    const existing = groups.get(key);
    if (existing) existing.numbers.push(i + 1);
    else groups.set(key, { key, citation: c, numbers: [i + 1] });
  });
  return [...groups.values()];
}

/** A `[Source N]` marker plus the whitespace in front of it. */
const MARKER = /(\s*)\[Source\s+(\d+)\]/g;

/**
 * While tokens stream in, a marker arrives in pieces ("[Sour", "ce 1]"). Hide a
 * dangling prefix at the very end so it doesn't flash as literal text.
 */
const PARTIAL_TAIL = /\[(?:S(?:o(?:u(?:r(?:c(?:e(?:\s+\d*)?)?)?)?)?)?)?$/;

/**
 * Turn `[Source N]` markers into markdown links `[N](#cite-N)` that the
 * renderer swaps for clickable badges.
 *
 * `sourceCount` is how many citations the server returned, or `null` while the
 * answer is still streaming (unknown yet — keep every marker). Once known,
 * markers pointing past the end are dropped, matching the server's own
 * `validate_citations` (the streamed text is unvalidated; only the saved copy is).
 */
export function prepareAnswer(
  text: string,
  opts: { sourceCount: number | null; streaming?: boolean },
): string {
  const base = opts.streaming ? text.replace(PARTIAL_TAIL, "") : text;
  return base.replace(MARKER, (_m, ws: string, n: string) => {
    const num = Number(n);
    if (opts.sourceCount !== null && (num < 1 || num > opts.sourceCount)) return "";
    return `${ws}[${num}](#cite-${num})`;
  });
}

/** Plain text for the clipboard: the answer without citation markers. */
export function stripMarkers(text: string): string {
  return text.replace(MARKER, "").replace(/[ \t]{2,}/g, " ").trim();
}
