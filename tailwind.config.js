/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
        chat: ["Segoe UI", "Helvetica Neue", "sans-serif"],
      },
      colors: {
        paper: "#f3eee6",
        ink: "#2a241c",
        sage: "#4b7a5c",
        wa: {
          teal: "#075e54",
          green: "#00a884",
          send: "#d9fdd3",
          bubble: "#ffffff",
          panel: "#f0f2f5",
          chat: "#efeae2",
          dark: "#0b141a",
          darkPanel: "#202c33",
          darkSend: "#005c4b",
          darkChat: "#0b141a",
        },
      },
    },
  },
  plugins: [],
};
