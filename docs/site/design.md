# 项目设计

本页是 Req2Rank 的完整技术设计文档，涵盖系统定位、架构、核心模块、数据结构和开发路线图。

## 系统定位

**一句话定义**：Req2Rank 是一个开源的 AI 编码能力评测框架。用户自行部署评测流水线，结果可上传至中心排行榜，形成社区驱动的 LLM 编码能力基准。

**核心差异化**：

| 特性 | 说明 |
|------|------|
| **动态题库** | 每次运行生成全新需求，杜绝数据泄漏 |
| **多模型陪审团** | LLM-as-a-Judge 交叉评审，去偏见 |
| **开源自部署** | 用户用自己的 API Key，在本地跑评测 |
| **社区排行榜** | 分数可提交到中心后端，公开可查 |

---

## 整体架构

系统分为两大部分：

| 部分 | 归属 | 部署 | 职责 |
|------|------|------|------|
| **评测引擎** (CLI) | 开源仓库 | 用户本地 | 出题、执行、评审、计分 |
| **排行榜中枢** (Hub) | 闭源托管 | 服务器 | 接收分数、验证、排行、展示 |

### 项目包结构（Monorepo）

本项目采用 `pnpm workspace` 组织的 Monorepo 结构，职责划分如下：

```text
Req-2-Rank/
├── packages/
│   ├── core/      # 评测引擎核心逻辑。包含出题、沙箱执行、打分聚合及所有 LLM Provider 适配代码。与具体交互方式（CLI/Web）解耦。
│   ├── cli/       # 终端应用。负责命令行参数解析、本地 SQLite 持久化和终端报告渲染。依赖 @req2rank/core。
│   ├── hub/       # 排行榜服务端与前端（Next.js）。提供 OAuth 认证、提交流程 API（含防作弊校验）及展示界面。
│   └── req2rank/  # 仅作 npm 发布入口，它是一个空包，通过 dependencies 导出 @req2rank/cli。
└── docs/          # 当前文档站 (VitePress)
```

**依赖流向**：
- `cli` 依赖 `core`
- `req2rank` 依赖 `cli`
- `hub` 独立于其他包，仅通过标准的 API JSON 协议与 `cli` 交互

```
┌───────────────── 用户侧（开源 CLI） ─────────────────┐
│                                                      │
│   CLI ──→ Pipeline Orchestrator                      │
│              ├── Requirement Generator （动态出题）    │
│              ├── Execution Engine      （代码生成）    │
│              ├── Evaluation Panel      （多模型评审）  │
│              └── Scoring Engine        （统计计分）    │
│                      │                               │
│                      ▼                               │
│               Local Report / Submit ──→ Hub          │
└──────────────────────────────────────────────────────┘

┌───────────────── 排行榜中枢（Hub） ──────────────────┐
│                                                      │
│   Submission API → Integrity Verifier → Leaderboard  │
│   GitHub OAuth   → Public Web + REST API             │
└──────────────────────────────────────────────────────┘
```

---

## 技术选型

### 评测引擎（开源端）

| 层次 | 选型 | 理由 |
|------|------|------|
| 语言 | TypeScript (Node.js) | 类型安全、生态丰富 |
| CLI | Commander.js | 主要入口，零依赖部署 |
| 本地存储 | SQLite (better-sqlite3) | 单文件数据库，无需外部服务 |
| ORM | Drizzle ORM | 轻量、类型安全 |
| LLM 适配 | 自建 Provider Adapter | 统一多厂商接口 |
| 配置校验 | Zod | 运行时类型校验 |

### 排行榜中枢

| 层次 | 选型 | 理由 |
|------|------|------|
| 框架 | Next.js (App Router) | SSR 排行榜页面 + API Routes |
| 数据库 | PostgreSQL + Drizzle | 生产级存储 |
| 部署 | Vercel | 免运维 |
| 认证 | GitHub OAuth | 提交分数需关联身份 |

---

## 核心模块设计

### Provider Adapter Layer

多厂商 API 适配层，统一接口：

```typescript
interface LLMProvider {
  id: string;
  name: string;
  chat(params: ChatParams): Promise<ChatResponse>;
}

interface ChatParams {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}
```

**支持的接口类型**：`openai` / `openai-response` / `gemini` / `anthropic` / `azure-openai` / `newapi`

---

### Requirement Generator — 需求生成引擎

不是简单的 Prompt 模板，而是一套**多维度、组合式、自校准**的动态出题引擎。

#### 能力矩阵（Skill Matrix）

二维矩阵：**能力标签 × 复杂度等级**。

**能力标签**：

| 标签 | 说明 | 示例 |
|------|------|------|
| `algorithm` | 算法与数据结构 | 排序、搜索、DP |
| `api-design` | 接口设计 | 路由、请求/响应格式 |
| `data-processing` | 数据处理 | CSV 解析、JSON 变换 |
| `error-handling` | 异常处理 | 输入校验、重试 |
| `concurrency` | 并发编程 | Promise 编排、限流 |
| `security` | 安全编码 | 输入消毒、认证鉴权 |
| `testing` | 测试编写 | 单元测试、Mock |
| `system-design` | 架构设计 | 分层、依赖注入 |
| `frontend` | UI 构建 | 组件、状态管理 |
| `database` | 数据建模 | Schema、SQL/ORM |

**复杂度等级**：

| 等级 | 代号 | 定义 | 约束 |
|------|------|------|------|
| C1 | `atomic` | 单一功能点 | 1 文件、1 函数 |
| C2 | `composed` | 2-3 个功能点组合 | 1-2 个文件 |
| C3 | `integrated` | 多功能协作 | 多文件、模块边界 |
| C4 | `architectural` | 完整应用架构 | 前后端分离 |

出题时从矩阵中随机选取：`{skills: ["api-design", "error-handling"], complexity: "C2"}`

#### 领域-场景分类法

能力矩阵决定"考什么"，领域场景决定"在什么背景下考"：

- **电商**：商品搜索、购物车、优惠券、库存管理、订单状态机
- **社交**：Feed 流、评论系统、通知推送、好友关系
- **金融**：交易记账、汇率转换、风控规则、报表生成
- **开发工具**：CLI 工具、配置解析器、日志分析、Mock Server
- **数据分析**：数据清洗、统计聚合、ETL 管道
- **游戏**：游戏循环、碰撞检测、存档系统
- **通用工具**：文件转换、缓存系统、任务调度、Markdown 渲染

#### 种子-变异机制

为保证质量和随机性，采用"种子 + 变异"策略：

1. **种子库**（内置 ~50 个）— 人工编写的高质量需求骨架
2. **变异操作** — 槽位填充、约束叠加、组合升级、领域迁移
3. **三阶段 Prompt Pipeline**：
   - Stage 1：骨架生成（能力矩阵 + 种子 + 领域 → 需求草稿）
   - Stage 2：对抗自审（挑刺：歧义？可实现？可量化？）
   - Stage 3：结构化输出（强制 JSON Schema + 补全评审提示）

#### PRD 数据结构

```typescript
interface ProjectRequirement {
  id: string;
  title: string;
  description: string;
  functionalRequirements: Array<{
    id: string;                     // "FR-1", "FR-2"
    description: string;
    acceptanceCriteria: string;     // 明确的通过/失败标准
    priority: "must" | "should" | "nice-to-have";
  }>;
  constraints: string[];
  expectedDeliverables: string[];
  metadata: {
    skills: string[];
    complexity: "C1" | "C2" | "C3" | "C4";
    domain: string;
    scenario: string;
  };
  evaluationGuidance: {
    keyDifferentiators: string[];   // 区分优秀与及格的关键点
    commonPitfalls: string[];      // 常见错误实现
    edgeCases: string[];           // 必须覆盖的边界条件
  };
}
```

---

### Execution Engine — 代码执行引擎

- 将 PRD 发给被测模型，强制 JSON 格式输出代码文件
- **容错**：JSON 解析失败时降级为正则提取代码块
- **超时映射**：

| 复杂度 | 超时 | 最大 Token |
|--------|------|-----------|
| C1 | 30s | 4K |
| C2 | 60s | 8K |
| C3 | 120s | 16K |
| C4 | 180s | 32K |

#### 沙箱执行隔离设计（Sandbox Execution Model）

为了在本地安全地运行大模型生成的不可信代码，并在较高复杂度（C3、C4）下真实检验代码逻辑，执行引擎内置了代码沙箱。

**沙箱生命周期**：

1. **环境准备**：基于 `R2R_SANDBOX_IMAGE` 启动隔离容器（默认 `node:20-alpine`）。
2. **挂载代码**：将被测模型生成的代码和依赖文件写入临时宿主目录，以只读方式挂载到容器内。
3. **注入探针**：自动向入口文件注入用于拦截报错、性能监控的测试探针代码。
4. **受限执行**：
   - **网络隔离**：断开外部网络，防止恶意渗透请求。
   - **资源限制**：限制最大 CPU 占用和内存（OOM）。
   - **时间控制**：若超过设定的 `R2R_SANDBOX_TIMEOUT_MS`，强制终止。
5. **结果捕获**：解析容器标准输出与错误码，将“编译失败”、“运行时崩溃”、“超时”直接转化为逻辑判定得分。

*注意：启用沙箱需本地已安装并运行 Docker 守护进程，并在配置/环境变量中开启 `R2R_SANDBOX_ENABLED=true`。*

---

### Evaluation Panel — 评审团

#### 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 功能完整性 | 30% | 是否实现所有功能点 |
| 代码质量 | 25% | 命名、结构、可读性 |
| 逻辑准确性 | 25% | 算法正确、边界处理 |
| 安全性 | 10% | 注入漏洞、硬编码秘钥 |
| 工程实践 | 10% | 错误处理、文档、测试 |

每个评审模型**独立打分**，不共享其他模型结果。

#### 一致性分析（IJA）

| σ 范围 | 等级 | 含义 |
|--------|------|------|
| σ ≤ 8 | `high` | 评审员基本一致 |
| 8 < σ ≤ 15 | `moderate` | 存在分歧但可接受 |
| σ > 15 | `low` | 严重分歧，需标记预警 |

---

### Scoring Engine — 评分引擎

**计算流程**：

```
收集评审分数 → 计算 IJA → 判断去极值条件
→ 加权求均值 → 计算 CI95 → 生成 warnings
```

**去极值条件**：评审员 ≥ 3 且总体一致性不为 `low`。

**CI95 计算**：`margin = 1.96 × (stdDev / √n)`

---

## 排行榜中枢设计

### 数据模型

- **User**：GitHub OAuth 用户（id, githubId, username, avatarUrl）
- **Submission**：评测提交（targetModel, overallScore, dimensionScores, ci95, evidenceChain, status）
- **LeaderboardEntry**：聚合排行（modelName, bestScore, avgScore, submissionCount）

### 提交流程 — 可审计证据链

```
CLI 申请 Nonce → 评测运行（Nonce 嵌入元数据）→ 组装证据包 → 提交到 Hub
Hub 验证 Nonce → 时间线合理性检查 → 合理性检查 → 异步抽样复验 → 写入排行榜
```

### 反作弊 — 七层验证

| 层 | 机制 | 说明 |
|----|------|------|
| L1 | 身份关联 | GitHub OAuth，作弊关联真实身份 |
| L2 | Server Nonce | 一次性令牌，防离线伪造 |
| L3 | 时序验证 | 检查各阶段时间戳合理性 |
| L4 | 统计检测 | CI 过窄或全满分触发异常标记 |
| L5 | 抽样复验 | Hub 用自有 API Key 重放评测 |
| L6 | 社区举报 | 公开审计数据，社区可标记 |
| L7 | 限频 | 每用户每天 ≤ 10 次提交 |

---

## Pipeline 编排器

### 执行模式

- **串行模式**（默认）：API 限流友好
- **并行模式**：加速评测，需配合并发控制

### 多轮测试

```
Round 1: 生成需求A → 写代码 → 评审 → 得分
Round 2: 生成需求B → 写代码 → 评审 → 得分
Round 3: 生成需求C → 写代码 → 评审 → 得分
最终得分 = avg(Round1, Round2, Round3)
```

### 断点续传

每阶段结果写入 SQLite，中断后可从检查点恢复。

---

## 错误处理策略

| 场景 | 策略 |
|------|------|
| API 限流 (429) | 指数退避重试（1s → 2s → 4s → 8s），最多 3 次 |
| API 超时 | 重试 1 次，仍超时则标记"超时"，计 0 分 |
| JSON 解析失败 | 降级正则提取，仍失败标记"格式错误" |
| 评审员返回无效分数 | 丢弃该评审结果，用剩余评审员 |
| 所有评审员失败 | 该需求标记"评审失败"，不计入总分 |
| Hub 提交失败 | 本地保留完整数据，提示重试 |

---

## 社区贡献方向

| 方向 | 说明 |
|------|------|
| 🔌 新增 Provider | 实现 `LLMProvider` 接口即可（如 Mistral、DeepSeek） |
| 📝 需求模板 | 贡献特定场景的 Prompt 模板 |
| 🌐 国际化 | CLI 输出和报告多语言 |
| 📊 可视化 | 新的图表类型 |
| 🧪 评分维度 | 自定义评分 Rubric |
