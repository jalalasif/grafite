"use client";

import { useState, type FormEvent } from "react";

/**
 * Login (§II.3): single password, posted to /api/auth/login which sets the
 * session cookie. On success the whole app becomes reachable (middleware). No
 * colour literals — styling is Tailwind utilities + theme tokens (Amendment 1).
 */
export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    setError(data?.error?.message ?? "Login failed. Please try again.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
        aria-label="Sign in to Grafite"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Grafite</h1>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50 focus-visible:ring-2"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
