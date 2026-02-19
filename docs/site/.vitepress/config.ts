import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Req2Rank",
  description: "Open benchmarking framework for coding models",
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Configuration", link: "/configuration" },
      { text: "Hub", link: "/hub" }
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Configuration", link: "/configuration" },
          { text: "Scoring Methodology", link: "/scoring-methodology" },
          { text: "Hub APIs and Pages", link: "/hub" },
          { text: "Contributing", link: "/contributing" }
        ]
      }
    ]
  }
});
