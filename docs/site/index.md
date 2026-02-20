# Req2Rank 文档

欢迎使用 **Req2Rank** — 面向 AI 编码能力的开源评测框架。

Req2Rank 通过动态需求生成、多模型陪审团评审和统计级置信分析，为 LLM 编码能力提供可信的评测基准。评测结果可提交至社区排行榜，公开可查。

## 核心特性

- 🎲 **动态出题** — 每次评测生成全新需求，杜绝训练集泄漏
- ⚖️ **多模型评审** — LLM-as-a-Judge 交叉评审，含一致性分析与 95% 置信区间
- 🔧 **本地自部署** — 只需 Node.js + API Key，无需额外基础设施
- 🏆 **社区排行榜** — 含 Nonce 防伪、抽样复验的可信提交流程

## 文档导航

| 文档 | 内容 |
|------|------|
| [快速开始](/getting-started) | 从安装到完成第一次评测的完整流程 |
| [使用指南](/guide) | CLI 全部命令的深度用法与典型场景 |
| [配置说明](/configuration) | `req2rank.config.json` 全字段参考 |
| [评分方法](/scoring-methodology) | 5 维度评分、IJA 一致性与 CI95 置信区间详解 |
| [Hub 排行榜](/hub) | 排行榜中枢的页面、提交流程与防作弊机制 |
| [项目设计](/design) | 系统架构、核心模块设计与开发路线图 |
| [API 参考](/api) | Hub 全部接口的请求/响应格式与认证方式 |
| [贡献指南](/contributing) | 开发环境搭建、代码规范与 PR 流程 |

## 快速链接

- 📦 **GitHub 仓库**：[Req-2-Rank](https://github.com/QingJ01/Req-2-Rank)
- 🌐 **线上排行榜**：[req2rank.top](https://req2rank.top)
- 📋 **MIT 开源协议**
