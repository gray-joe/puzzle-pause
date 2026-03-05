import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#15191e",
        "text-primary": "#e0e0e0",
        teal: "#4ecca3",
        orange: "#ff9f43",
        error: "#ff6b6b",
        muted: "#808080",
        border: "#3a3a3a",
      },
      fontFamily: {
        mono: ["Monaco", "Cascadia Code", "Fira Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
