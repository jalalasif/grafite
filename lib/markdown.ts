/**
 * Markdown → sanitised, wikilink/tag-aware, syntax-highlighted HTML (§II.5.5).
 * Pure — no framework, no database. The caller resolves slugs→notes and
 * filenames→urls first and passes them in as maps; this module never touches I/O.
 *
 * Pipeline: remark-parse → remark-gfm → wikilink plugin → tag plugin →
 * remark-rehype (raw HTML dropped) → rehype-sanitize → shiki → rehype-stringify.
 *
 * The wikilink/tag transforms operate on mdast `text` nodes; because remark
 * keeps code in separate `code`/`inlineCode` nodes, links/tags inside code are
 * never touched (matching lib/wikilinks + lib/tags). Transclusion is one level
 * deep: a transcluded body is re-rendered with transclusion disabled, so a
 * nested `![[…]]` degrades to a plain link and cycles terminate.
 */

import { unified, type Plugin } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { codeToHast } from "shiki";
import type { Root, RootContent, Parent } from "mdast";
import type {
  Root as HastRoot,
  Element as HastElement,
  Text as HastText,
} from "hast";
import { parseWikilinks, type WikilinkRef } from "./wikilinks";
import { parseTags } from "./tags";

export interface RenderNote {
  title: string;
  body: string;
}

export interface RenderContext {
  /** slug → note. Presence means the wikilink resolves. */
  notes?: Map<string, RenderNote>;
  /** asset filename → URL. */
  assets?: Map<string, string>;
}

const IMAGE_EXT = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const SHIKI_THEME = "github-light";
const SUPPORTED_LANGS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "bash",
  "sh",
  "shell",
  "python",
  "py",
  "html",
  "css",
  "sql",
  "yaml",
  "yml",
  "markdown",
  "md",
  "go",
  "rust",
  "diff",
]);

// A loose mdast node — custom nodes carry data.hName so remark-rehype renders
// them as the element we want.
type Node = RootContent & Record<string, unknown>;

function headingAnchor(heading: string): string {
  return heading.trim().toLowerCase().replace(/\s+/g, "-");
}

function textNode(value: string): Node {
  return { type: "text", value } as unknown as Node;
}

function wikiLink(
  ref: WikilinkRef,
  title: string | undefined,
  broken: boolean,
): Node {
  const href =
    `/notes/${ref.target}` +
    (ref.heading ? `#${headingAnchor(ref.heading)}` : "");
  return {
    type: "link",
    url: href,
    title: null,
    data: {
      hProperties: {
        className: broken ? ["wikilink", "broken"] : ["wikilink"],
      },
    },
    children: [textNode(ref.display ?? title ?? ref.target)],
  } as unknown as Node;
}

function assetImage(url: string, alt: string): Node {
  return {
    type: "image",
    url,
    alt,
    data: { hProperties: { className: ["embed"] } },
  } as unknown as Node;
}

function brokenEmbed(name: string): Node {
  return {
    type: "brokenEmbed",
    data: { hName: "span", hProperties: { className: ["embed", "broken"] } },
    children: [textNode(name)],
  } as unknown as Node;
}

function transclusion(body: string, ctx: RenderContext): Node {
  return {
    type: "transclusion",
    data: { hName: "div", hProperties: { className: ["transclusion"] } },
    children: renderMdastOneLevel(body, ctx),
  } as unknown as Node;
}

/** Turn one wikilink ref into the node(s) that replace it. */
function wikilinkToNodes(
  ref: WikilinkRef,
  ctx: RenderContext,
  allowTransclusion: boolean,
): Node {
  if (ref.isEmbed) {
    if (IMAGE_EXT.test(ref.target)) {
      const url = ctx.assets?.get(ref.target);
      return url ? assetImage(url, ref.target) : brokenEmbed(ref.target);
    }
    const note = ctx.notes?.get(ref.target);
    if (!note) return brokenEmbed(ref.target);
    return allowTransclusion
      ? transclusion(note.body, ctx)
      : wikiLink(ref, note.title, false); // nested embed degrades to a link
  }
  const note = ctx.notes?.get(ref.target);
  return note
    ? wikiLink(ref, note.title, false)
    : wikiLink(ref, undefined, true);
}

/** Split a text value into text + wikilink nodes, or null if there are none. */
function splitWikilinks(
  value: string,
  ctx: RenderContext,
  allowTransclusion: boolean,
): Node[] | null {
  const refs = parseWikilinks(value);
  if (refs.length === 0) return null;
  const out: Node[] = [];
  let cursor = 0;
  for (const ref of refs) {
    if (ref.start > cursor) out.push(textNode(value.slice(cursor, ref.start)));
    out.push(wikilinkToNodes(ref, ctx, allowTransclusion));
    cursor = ref.end;
  }
  if (cursor < value.length) out.push(textNode(value.slice(cursor)));
  return out;
}

function tagLink(raw: string, path: string): Node {
  return {
    type: "link",
    url: `/tags/${path}`,
    title: null,
    data: { hProperties: { className: ["tag"] } },
    children: [textNode(raw)],
  } as unknown as Node;
}

/** Split a text value into text + tag nodes, or null if there are none. */
function splitTags(value: string): Node[] | null {
  const refs = parseTags(value);
  if (refs.length === 0) return null;
  const out: Node[] = [];
  let cursor = 0;
  for (const ref of refs) {
    if (ref.start > cursor) out.push(textNode(value.slice(cursor, ref.start)));
    out.push(tagLink(ref.raw, ref.path));
    cursor = ref.end;
  }
  if (cursor < value.length) out.push(textNode(value.slice(cursor)));
  return out;
}

function remarkWikilinks(options: {
  ctx: RenderContext;
  allowTransclusion: boolean;
}): ReturnType<Plugin> {
  return (tree) => {
    visit(tree as Root, "text", (node, index, parent) => {
      const replacement = splitWikilinks(
        node.value,
        options.ctx,
        options.allowTransclusion,
      );
      if (!replacement) return;
      const p = parent as Parent;
      const i = index as number;
      p.children.splice(i, 1, ...(replacement as unknown as RootContent[]));
      return i + replacement.length;
    });
  };
}

function remarkTags(): ReturnType<Plugin> {
  return (tree) => {
    visit(tree as Root, "text", (node, index, parent) => {
      // Don't re-scan text that already lives inside a link (a wikilink/tag
      // display), so a `#` in display text is not turned into a tag.
      if ((parent as Parent).type === "link") return;
      const replacement = splitTags(node.value);
      if (!replacement) return;
      const p = parent as Parent;
      const i = index as number;
      p.children.splice(i, 1, ...(replacement as unknown as RootContent[]));
      return i + replacement.length;
    });
  };
}

/** Parse a body to mdast and apply the wikilink/tag transforms one level deep
 * (transclusion disabled). Used to render a transcluded note inline. */
function renderMdastOneLevel(body: string, ctx: RenderContext): RootContent[] {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikilinks, { ctx, allowTransclusion: false })
    .use(remarkTags);
  const tree = processor.runSync(processor.parse(body)) as Root;
  return tree.children;
}

// rehype-sanitize schema: the default (GitHub) schema plus our own class names
// on the elements the plugins emit. Everything else stays locked down; raw HTML
// in the body is already dropped by remark-rehype (no allowDangerousHtml).
//
// The default schema restricts `className` per element (e.g. `<a>` may only
// carry `data-footnote-backref`), so we must merge our allowed class values in
// rather than add a bare `className` — a bare entry is overridden by the
// restrictive one and the class is emptied.
type AttrEntry =
  string | (string | number | boolean | RegExp | null | undefined)[];

/** Merge `extra` allowed class values into an element's attribute list,
 * preserving every non-`className` entry and any class values already allowed.
 * Exported for direct testing (its branches can't all be reached via the
 * default schema's attribute lists). */
export function withClasses(
  existing: AttrEntry[] | undefined,
  extra: string[],
): AttrEntry[] {
  const kept: AttrEntry[] = [];
  const classValues: (string | number | boolean | RegExp | null | undefined)[] =
    [];
  for (const entry of existing ?? []) {
    if (entry === "className") continue;
    if (Array.isArray(entry) && entry[0] === "className") {
      classValues.push(...entry.slice(1));
      continue;
    }
    kept.push(entry);
  }
  return [...kept, ["className", ...classValues, ...extra]];
}

// defaultSchema.tagNames / .attributes are always populated by hast-util-
// sanitize, so read them directly (no `?? []` / `?.` defensive branches).
const baseAttributes = defaultSchema.attributes!;
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames!, "span", "div"],
  attributes: {
    ...baseAttributes,
    a: withClasses(baseAttributes.a, ["wikilink", "broken", "tag"]),
    img: withClasses(baseAttributes.img, ["embed"]),
    span: withClasses(baseAttributes.span, ["embed", "broken"]),
    div: withClasses(baseAttributes.div, ["transclusion"]),
  },
} as unknown as typeof defaultSchema;

/** Concatenate the text of a `<code>` node. remark-rehype gives a fenced code
 * block a single text child, so a branchless filter/map/join covers it. */
function codeText(node: HastElement): string {
  return node.children
    .filter((c): c is HastText => c.type === "text")
    .map((c) => c.value)
    .join("");
}

/** Read the language from a `<code class="language-x">` — remark-rehype emits
 * exactly that class for a labelled fence, and nothing for an unlabelled one. */
function langFromClass(className: unknown): string {
  const first = Array.isArray(className) ? className[0] : undefined;
  return typeof first === "string" ? first.replace(/^language-/, "") : "text";
}

/** Highlight fenced code with shiki. Runs after sanitize, so shiki's inline
 * styles are trusted output and survive. */
function rehypeShiki(): (tree: HastRoot) => Promise<void> {
  return async (tree) => {
    const jobs: { pre: HastElement; text: string; lang: string }[] = [];
    visit(tree, "element", (node, _index, parent) => {
      if (node.tagName !== "code") return;
      const pre = parent as HastElement;
      if (pre.tagName !== "pre") return; // inline code is skipped
      jobs.push({
        pre,
        text: codeText(node),
        lang: langFromClass(node.properties?.className),
      });
    });
    for (const job of jobs) {
      const lang = SUPPORTED_LANGS.has(job.lang) ? job.lang : "text";
      const out = await codeToHast(job.text, { lang, theme: SHIKI_THEME });
      const shikiPre = out.children[0] as HastElement;
      job.pre.properties = shikiPre.properties;
      job.pre.children = shikiPre.children;
    }
  };
}

export async function renderMarkdown(
  markdown: string,
  ctx: RenderContext = {},
): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikilinks, { ctx, allowTransclusion: true })
    .use(remarkTags)
    .use(remarkRehype)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeShiki)
    .use(rehypeStringify);
  const file = await processor.process(markdown);
  return String(file);
}
