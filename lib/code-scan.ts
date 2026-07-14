/**
 * Code-region masking (pure). Both the wikilink and tag parsers must ignore
 * anything inside fenced or inline code (§II.5.1, §II.5.2). This produces a
 * per-character boolean mask (`true` = inside code) so those parsers can keep
 * byte-accurate positions while skipping code.
 *
 * Simplifications (documented in conventions.md):
 *  - a fence is a line starting (after optional indent) with 3+ backticks or
 *    tildes; it is closed by a line starting with the same fence character;
 *  - inline code spans are matched within a single line: an opening run of N
 *    backticks closes on the next run of exactly N backticks on that line; an
 *    unmatched run is literal text.
 */

interface LineInfo {
  start: number;
  content: string;
}

function splitLines(text: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      lines.push({ start, content: text.slice(start, i) });
      start = i + 1;
    }
  }
  return lines;
}

function maskRange(mask: boolean[], from: number, to: number): void {
  for (let i = from; i < to; i++) mask[i] = true;
}

function maskInlineCode(mask: boolean[], line: string, base: number): void {
  const runRe = /`+/g;
  const runs: { index: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = runRe.exec(line)) !== null) {
    runs.push({ index: m.index, len: m[0].length });
  }
  let i = 0;
  while (i < runs.length) {
    const open = runs[i]!;
    let j = i + 1;
    while (j < runs.length && runs[j]!.len !== open.len) j++;
    if (j < runs.length) {
      const close = runs[j]!;
      maskRange(mask, base + open.index, base + close.index + close.len);
      i = j + 1;
    } else {
      i++;
    }
  }
}

export function maskCode(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  let inFence = false;
  let fenceChar = "";

  for (const { start, content } of splitLines(text)) {
    const end = start + content.length;
    // The char at `end` is the line's trailing '\n' when one exists.
    const hasNewline = end < text.length;
    const fence = /^[ \t]*(`{3,}|~{3,})/.exec(content);
    if (fence) {
      const marker = fence[1]![0]!;
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
        maskRange(mask, start, end);
        if (hasNewline) mask[end] = true; // keep the block contiguous
        continue;
      }
      if (marker === fenceChar) {
        // Closing fence: mask the line but not its trailing newline, so text
        // after the block stays parseable.
        maskRange(mask, start, end);
        inFence = false;
        fenceChar = "";
        continue;
      }
    }
    if (inFence) {
      maskRange(mask, start, end);
      if (hasNewline) mask[end] = true;
      continue;
    }
    maskInlineCode(mask, content, start);
  }
  return mask;
}
