import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f7f8f6",
        ink: "#0a1a12",
        mint: "#00e87a",
        "mint-dark": "#00c468",
        "text-primary": "#0d1f17",
        "text-secondary": "#6b7280",
        surface: "#ffffff",
        line: "#e5e7eb",
        danger: "#dc2626",
        warn: "#d97706",
        info: "#2563eb",
      },
      borderRadius: {
        card: "14px",
      },
      fontFamily: {
        display: ['"Clash Display"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
