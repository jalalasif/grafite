import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "grafite");
    document.documentElement.setAttribute("data-mode", "light");
    localStorage.clear();
  });

  it("flips data-mode on <html> and persists the choice", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByTestId("theme-toggle");

    expect(document.documentElement.getAttribute("data-mode")).toBe("light");
    expect(btn).toHaveAttribute("aria-label", "Switch to dark mode");

    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
    expect(localStorage.getItem("grafite.mode")).toBe("dark");

    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-mode")).toBe("light");
    expect(localStorage.getItem("grafite.mode")).toBe("light");
  });
});
