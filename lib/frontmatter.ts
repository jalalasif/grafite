/**
 * YAML frontmatter round-trip (§II.5.6). Pure — no framework, no I/O.
 *
 * Frontmatter is parsed on import and serialised on export, but is never stored
 * as its own column — it round-trips through the body. This is deliberately a
 * minimal, hand-rolled parser (there is no YAML dependency in `lib/`): it only
 * recognises a `---` fence at the very start of a file, extracts `tags:` (a flow
 * list, comma string, single value, or an indented block list), and passes every
 * other `key: value` pair through untouched. Tag matching/lowercasing happens
 * later in the tag layer; here values are only trimmed.
 */

export interface Frontmatter {
  /** Non-`tags` key/value pairs, values kept as raw trimmed strings. */
  data: Record<string, string>;
  /** Tags from a `tags:` field, in order, trimmed and de-duplicated. */
  tags: string[];
  /** The body with the leading frontmatter block removed. */
  content: string;
}

/** A `---` fence line (LF or CRLF, tolerating trailing spaces/tabs). */
function isFence(line: string): boolean {
  return /^---[ \t]*\r?$/.test(line);
}

/** Split an inline `tags:` value: `[a, b]`, `a, b`, or a single `a`. */
function splitInlineTags(value: string): string[] {
  const flow = /^\[(.*)\]$/.exec(value);
  const inner = flow ? flow[1]! : value;
  return inner.split(",").map((entry) => entry.trim());
}

export function parseFrontmatter(body: string): Frontmatter {
  const src = body.charCodeAt(0) === 0xfeff ? body.slice(1) : body; // strip BOM
  const lines = src.split("\n");

  if (!isFence(lines[0]!)) {
    return { data: {}, tags: [], content: body };
  }

  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (isFence(lines[i]!)) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return { data: {}, tags: [], content: body };
  }

  const fmLines = lines.slice(1, close).map((line) => line.replace(/\r$/, ""));
  // Everything after the closing fence line; the join re-emits exactly the
  // original separators, so precisely one leading newline is stripped.
  const content = lines.slice(close + 1).join("\n");

  const data: Record<string, string> = {};
  const rawTags: string[] = [];

  for (let i = 0; i < fmLines.length; i++) {
    const kv = /^([^:]+):(.*)$/.exec(fmLines[i]!);
    if (!kv) continue;
    const key = kv[1]!.trim();
    const rest = kv[2]!.trim();

    if (key.toLowerCase() === "tags") {
      if (rest === "") {
        // Block list: consume the following indented `- item` lines.
        let j = i + 1;
        while (j < fmLines.length) {
          const item = /^[ \t]*-[ \t]*(.*)$/.exec(fmLines[j]!);
          if (!item) break;
          rawTags.push(item[1]!.trim());
          j++;
        }
        i = j - 1;
      } else {
        rawTags.push(...splitInlineTags(rest));
      }
    } else {
      data[key] = rest;
    }
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const tag of rawTags) {
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return { data, tags, content };
}

export function serialiseFrontmatter(
  fields: {
    title?: string;
    tags?: string[];
    created?: string;
    updated?: string;
  },
  body: string,
): string {
  const lines: string[] = [];
  if (fields.title !== undefined) lines.push(`title: ${fields.title}`);
  if (fields.tags !== undefined && fields.tags.length > 0) {
    lines.push(`tags: [${fields.tags.join(", ")}]`);
  }
  if (fields.created !== undefined) lines.push(`created: ${fields.created}`);
  if (fields.updated !== undefined) lines.push(`updated: ${fields.updated}`);
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}
