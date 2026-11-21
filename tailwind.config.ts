import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      // Code đang dùng một số class chỉ có ở Tailwind v4 (shadow-xs, shadow-2xs,
      // backdrop-blur-xs, border-l-3); khai báo lại với đúng giá trị của v4.
      boxShadow: {
        "2xs": "0 1px rgb(0 0 0 / 0.05)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      backdropBlur: {
        xs: "4px",
      },
      borderWidth: {
        3: "3px",
      },
    },
  },
  plugins: [],
};
export default config;
