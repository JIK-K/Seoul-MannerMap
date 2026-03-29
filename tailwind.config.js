/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e17",
        surface: "#111827",
        border: "#1f2937",
        accent: "#4ade80",
        muted: "#6b7280",
        smoke: "#f59e0b",
        toilet: "#06b6d4",
        fire: "#ef4444",
      },
      fontFamily: {
        sans: ["'Noto Sans KR'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.2 },
        },
        fadeUp: {
          from: { opacity: 0, transform: "translateY(16px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        blink: "blink 1.4s ease infinite",
        fadeUp: "fadeUp 0.6s ease both",
        fadeUp2: "fadeUp 0.6s 0.1s ease both",
      },
    },
  },
  plugins: [],
};
