import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Req2Rank",
  description: "面向代码模型的开源评测框架",
  themeConfig: {
    nav: [
      { text: "快速开始", link: "/getting-started" },
      { text: "配置说明", link: "/configuration" },
      { text: "Hub", link: "/hub" }
    ],
    sidebar: [
      {
        text: "文档",
        items: [
          { text: "快速开始", link: "/getting-started" },
          { text: "配置说明", link: "/configuration" },
          { text: "评分方法", link: "/scoring-methodology" },
          { text: "Hub API 与页面", link: "/hub" },
          { text: "贡献指南", link: "/contributing" }
        ]
      }
    ]
  }
});
