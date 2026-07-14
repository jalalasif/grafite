import { put as vercelPut, del as vercelDel } from "@vercel/blob";
import { getEnv } from "@/lib/env";
import { type BlobGateway } from "./blob";

/**
 * Real Vercel Blob adapter (DT-5 boundary — excluded from coverage; it cannot
 * run without BLOB_READ_WRITE_TOKEN and a network). Behaviour is exercised in
 * production only; services/routes are tested against the in-memory gateway.
 */
export function createVercelBlob(): BlobGateway {
  const token = getEnv().BLOB_READ_WRITE_TOKEN;
  return {
    async put(pathname, data, contentType) {
      const result = await vercelPut(pathname, data as unknown as Blob, {
        access: "public",
        contentType,
        token,
        addRandomSuffix: true,
      });
      return { url: result.url, pathname: result.pathname };
    },
    async get(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`blob fetch failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async del(url) {
      await vercelDel(url, { token });
    },
  };
}
