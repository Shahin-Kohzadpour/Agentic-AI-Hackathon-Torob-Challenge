import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        torob: {
          red: "#d32f2f",
          darkred: "#b71c1c",
          lightred: "#ffebee",
          gray: "#f5f5f5",
          darkgray: "#424242",
          border: "#e0e0e0"
        }
      },
      fontFamily: {
        sans: ["Vazirmatn", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
