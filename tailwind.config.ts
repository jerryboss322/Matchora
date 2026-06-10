import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Fira Code", "monospace"],
      },
      colors: {
        // Expose CSS vars as Tailwind utilities
        "surface-base": "var(--surface-base)",
        "surface-panel": "var(--surface-panel)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-border": "var(--surface-border)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "accent-primary": "var(--accent-primary)",
      },
    },
  },
  plugins: [],
};

export default config;
