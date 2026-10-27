/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 300: "#C4B5FD", 400: "#A78BFA",
          500: "#8B5CF6", 600: "#7C3AED", 700: "#6D28D9", 800: "#5B21B6", 900: "#4C1D95",
        },
        accent: { 400: "#22D3EE", 500: "#06B6D4", 600: "#0891B2", 700: "#0E7490" },
        gold: {
          400: "#F4B740",
          500: "#E8A33D",
        },
        surface: {
          light: "#F7F7FB", card: "#FFFFFF", border: "#E6E6F0",
          dark: "#0B0B12", "card-dark": "#13131D", "border-dark": "#252538",
        },
        ink: { light: "#1A1A2E", dark: "#ECECF6" },
        success: "#22A559",
        warning: "#E8A33D",
        error: "#E5484D",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(20, 16, 50, 0.07), 0 1px 1px rgba(20,16,50,0.05)",
        medium: "0 4px 16px rgba(20, 16, 50, 0.10), 0 2px 6px rgba(20,16,50,0.06)",
        prominent: "0 12px 32px rgba(20, 16, 50, 0.22), 0 4px 12px rgba(20,16,50,0.12)",
        "glow-brand": "0 0 0 4px rgba(139, 92, 246, 0.25)",
        "glow-accent": "0 0 0 4px rgba(34, 211, 238, 0.22)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out both",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "slide-down": "slideDown 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
        "sheet-up": "sheetUp 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "heart-burst": "heartBurst 0.7s ease-out both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "stagger-in": "staggerIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(14px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        slideDown: { "0%": { opacity: 0, transform: "translateY(-10px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        scaleIn: { "0%": { opacity: 0, transform: "scale(0.95)" }, "100%": { opacity: 1, transform: "scale(1)" } },
        sheetUp: { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
        heartBurst: {
          "0%": { transform: "scale(0.4)", opacity: 0 },
          "30%": { transform: "scale(1.25)", opacity: 1 },
          "60%": { transform: "scale(0.95)", opacity: 1 },
          "100%": { transform: "scale(1.4)", opacity: 0 },
        },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        staggerIn: { "0%": { opacity: 0, transform: "translateY(10px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
