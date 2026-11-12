"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
type Theme = "system" | "light" | "dark";
export default function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mailroom-theme");
      if (saved === "dark" || saved === "light" || saved === "system") {
        setTheme(saved);
        document.documentElement.dataset.theme = saved;
      }
    } catch {
      /* Storage may be disabled; system colors still work. */
    }
  }, []);
  function change(value: Theme) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("mailroom-theme", value);
    } catch {}
  }
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <label className="theme-picker">
      <Icon size={15} aria-hidden="true" />
      <select
        aria-label="Color theme"
        value={theme}
        onChange={(e) => change(e.target.value as Theme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
