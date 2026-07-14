import type { Metadata } from "next";
import type { ReactNode } from "react";
import { themesToCss, foucInlineScript } from "@/themes/tokens";
import { DEFAULT_THEME_ID } from "@/themes/registry";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grafite",
  description:
    "A single-user, self-hosted note-taking app: Obsidian mechanics, Bear restraint.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME_ID}
      data-mode="light"
      suppressHydrationWarning
    >
      <head>
        {/* All theme×mode token rules, keyed by data-theme/data-mode (Amendment 1). */}
        <style dangerouslySetInnerHTML={{ __html: themesToCss() }} />
        {/* Runs before paint: applies the persisted theme/mode → no FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: foucInlineScript() }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
