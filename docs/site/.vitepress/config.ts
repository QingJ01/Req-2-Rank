import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Req2Rank",
  description: "面向代码模型的开源评测框架",
  themeConfig: {
    nav: [
      { text: "快速开始", link: "/getting-started" },
      { text: "命令总览", link: "/guide" },
      { text: "配置说明", link: "/configuration" },
      { text: "项目设计", link: "/design" },
      { text: "Hub", link: "https://req2rank.top", target: "_blank", rel: "noreferrer" }
    ],
    sidebar: [
      {
        text: "文档",
        items: [
          { text: "快速开始", link: "/getting-started" },
          { text: "命令总览", link: "/guide" },
          { text: "配置说明", link: "/configuration" },
          { text: "API 参考", link: "/api" },
          { text: "评分方法", link: "/scoring-methodology" },
          { text: "Hub 排行榜", link: "/hub" },
          { text: "项目设计", link: "/design" },
          { text: "贡献指南", link: "/contributing" }
        ]
      }
    ]
  }
});

