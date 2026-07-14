/**
 * Blob storage gateway (§II.6, DT-5). Screenshots and pasted images live in
 * Vercel Blob in production, but that needs a credential this build does not
 * have — so services and routes depend on this INTERFACE and receive an
 * implementation. Tests inject {@link createMemoryBlob}; the real Vercel adapter
 * lives in `blob-vercel.ts` (excluded from coverage — it is the external
 * boundary).
 */

export interface PutResult {
  url: string;
  pathname: string;
}

export interface BlobGateway {
  put(
    pathname: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<PutResult>;
  get(url: string): Promise<Uint8Array>;
  del(url: string): Promise<void>;
}

/** In-memory blob store for tests — deterministic, no network. */
export function createMemoryBlob(): BlobGateway {
  const byUrl = new Map<string, Uint8Array>();
  let seq = 0;
  return {
    async put(pathname, data) {
      // Mimic Vercel's dedupe-suffix so repeated pathnames get distinct urls.
      const url = `memory://blob/${seq++}/${pathname}`;
      byUrl.set(url, data);
      return { url, pathname };
    },
    async get(url) {
      const data = byUrl.get(url);
      if (!data) throw new Error(`blob not found: ${url}`);
      return data;
    },
    async del(url) {
      byUrl.delete(url);
    },
  };
}
