/**
 * WCAG 2.x contrast math (Amendment 1 to the build spec). Pure — no framework,
 * no I/O, no npm dependency.
 *
 * This is the relative-luminance and contrast-ratio implementation the theme
 * system's tests use to prove every theme clears WCAG AA 4.5:1 for text/bg and
 * accent/bg in both light and dark modes. Formulas follow the W3C definitions:
 *   - relative luminance:
 *     https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *   - contrast ratio:
 *     https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/** WCAG AA minimum contrast for normal-size text. */
const AA_NORMAL = 4.5;
/** WCAG AA minimum contrast for large text (>= 18pt, or 14pt bold). */
const AA_LARGE = 3.0;

/**
 * Parse `#RGB`, `#RRGGBB`, or the same without the leading `#` (case
 * insensitive) into `[r, g, b]` byte channels (0..255). Throws on any other
 * length or on non-hex characters.
 */
function parseHex(hex: string): [number, number, number] {
  const body = hex.startsWith("#") ? hex.slice(1) : hex;

  if (!/^[0-9a-fA-F]+$/.test(body)) {
    throw new Error(`Invalid hex colour: "${hex}" contains non-hex characters`);
  }

  let full: string;
  if (body.length === 3) {
    full = body.replace(/./g, (ch) => ch + ch); // expand #RGB → #RRGGBB
  } else if (body.length === 6) {
    full = body;
  } else {
    throw new Error(
      `Invalid hex colour: "${hex}" must be 3 or 6 hex digits (#RGB or #RRGGBB)`,
    );
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Linearise a single sRGB byte channel (0..255) per the WCAG definition. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance of a hex colour, in 0..1 (0 = black, 1 = white).
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG contrast ratio between two hex colours, in 1..21. Symmetric: the result
 * does not depend on argument order.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Whether `foreground` on `background` clears WCAG AA: 4.5:1 for normal text,
 * or 3.0:1 when `largeText` is true.
 */
export function meetsAA(
  foreground: string,
  background: string,
  largeText = false,
): boolean {
  const threshold = largeText ? AA_LARGE : AA_NORMAL;
  return contrastRatio(foreground, background) >= threshold;
}
