import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://mbaneshi.github.io",
  base: "/pargar",
  integrations: [
    starlight({
      title: "Pargar",
      description: "An open-source, browser-native 2D CAD with a Rust/WASM kernel and AI agents as first-class users.",
      favicon: "/favicon.svg",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        fa: { label: "فارسی", lang: "fa", dir: "rtl" },
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/mbaneshi/pargar" },
        { icon: "external", label: "Open the app", href: "https://cad.houshkar.ir" },
      ],
      components: { Footer: "./src/components/Footer.astro" },
      editLink: { baseUrl: "https://github.com/mbaneshi/pargar/edit/dev/site/" },
      customCss: [
        "@fontsource-variable/inter",
        "@fontsource-variable/fraunces",
        "@fontsource-variable/jetbrains-mono",
        "@fontsource-variable/vazirmatn",
        "./src/styles/brand.css",
      ],
      expressiveCode: {
        themes: ["github-dark", "github-light"],
        styleOverrides: {
          codeBackground: "var(--sl-color-gray-6)",
          borderColor: "var(--sl-color-gray-5)",
          codeFontFamily: "var(--sl-font-mono)",
        },
      },
      sidebar: [
        { label: "Start here", translations: { fa: "شروع" }, items: [{ slug: "getting-started" }] },
        {
          label: "Design",
          translations: { fa: "طراحی" },
          items: [{ slug: "architecture" }, { slug: "ai" }],
        },
        {
          label: "Project",
          translations: { fa: "پروژه" },
          items: [{ slug: "roadmap" }, { slug: "contribute" }],
        },
      ],
    }),
  ],
});
