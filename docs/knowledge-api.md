# Knowledge API 使用说明

本文档说明知识库的调用方式，覆盖两类调用者：

- 内部 Agent（工具调用）
- 外部系统（REST 接口）

所有 REST 路由目前都挂在 `/api/knowledge/*` 下。

外部调用（不使用浏览器会话）请使用 API Token 鉴权：

- `Authorization: Bearer <token>`，或
- `x-api-token: <token>` / `x-api-key: <token>`

接口仍兼容已有的浏览器登录会话，内部管理界面可继续通过页面 Cookie 访问。

## 内部 Agent 工具

Agent 执行时，默认会在工作流中按工具名调用。

### `memory.read`

读取指定知识条目 URI。

参数：

- `uri`（必填）：`agentworld://...`
- `level`（可选）：`L0 | L1 | L2`，默认 `L2`

返回：

- `content`：目标内容
- `details`：`uri`, `level`, `contentLength`

### `memory.search`

按关键词在可见知识空间中检索。

参数：

- `query`（必填）
- `knowledgeSpaceIds`（可选，string[]）
- `scopeUris`（可选，string[]）
- `knowledgeCategories`（可选，string[]）：`global | domain | skill | codebase`。旧值 `public`、`code`、`repository` 仅作为兼容别名读取。
- `repositoryNames`（可选，string[]）：代码仓知识过滤，支持仓库名、`owner/repo`、仓库 URL 等别名。
- `levels`（可选，`L0`/`L1`/`L2`，可多选）
- `limit`（可选，1-64）
- `includeOutboundUris`（可选，bool）

返回：`searchKnowledgeEntries` 的标准命中结构（`query`, `scope`, `totalEntries`, `totalCandidates`, `hits`）。

### `memory.retrieve`

兼容别名，参数与 `memory.search` 一致，建议逐步过渡到 `memory.search`。

## 外部 REST 接口

### 1) `GET /api/knowledge/read`

读取知识条目。

示例：

```bash
curl -G 'http://localhost:7369/api/knowledge/read' \
  -H 'Authorization: Bearer <YOUR_KNOWLEDGE_API_TOKEN>' \
  --data-urlencode 'uri=agentworld://knowledge/resources/agentworld/teams/global/default/discovery-url/e7b1461b-117e-4dad-a21a-0ee5100eaa7d.md' \
  --data-urlencode 'level=L2'
```

返回：

- `ok`: true
- `uri`: 入参
- `level`: 实际读取层
- `content`: Markdown 内容

同样支持 `POST /api/knowledge/read`，请求体：

```json
{ "uri": "agentworld://knowledge/.../xx.md", "level": "L2" }
```

### 2) `GET /api/knowledge/query`

按关键词检索。

示例（GET）：

```bash
curl -G 'http://localhost:7369/api/knowledge/query' \
  -H 'Authorization: Bearer <YOUR_KNOWLEDGE_API_TOKEN>' \
  --data-urlencode 'query=LLM Wiki' \
  --data-urlencode 'limit=5' \
  --data-urlencode 'levels=L1' \
  --data-urlencode 'levels=L2'
```

示例（POST）：

```bash
curl -X POST http://localhost:7369/api/knowledge/query \
  -H 'Authorization: Bearer <YOUR_KNOWLEDGE_API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"query":"LLM Wiki","levels":["L1","L2"],"limit":5}'
```

示例（只检索某个代码仓知识）：

```bash
curl -X POST http://localhost:7369/api/knowledge/query \
  -H 'Authorization: Bearer <YOUR_KNOWLEDGE_API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"query":"鉴权边界","knowledgeCategories":["codebase"],"repositoryNames":["sigmund/obsidian-articles"],"levels":["L0","L1","L2"],"limit":8}'
```

返回：

- `ok`: true
- `result`: 与 `searchKnowledgeEntries` 一致的检索包

### 3) `GET /api/knowledge/retrieve`

检索与任务运行上下文读取（GET/POST 均支持）。

- `query` 与 `taskRunId` 二选一（都不传则 400）
- 提供 `taskRunId` 时会读取该任务快照上下文（`knowledgeContext`）和执行时默认查询；
- 提供 `query` 时执行标准检索。

示例（GET）：

```bash
curl -G 'http://localhost:7369/api/knowledge/retrieve' \
  -H 'Authorization: Bearer <YOUR_KNOWLEDGE_API_TOKEN>' \
  --data-urlencode 'query=如何使用 LLM Wiki' \
  --data-urlencode 'knowledgeSpaceIds=space-id' \
  --data-urlencode 'levels=L1' \
  --data-urlencode 'levels=L2' \
  --data-urlencode 'limit=6'
```

示例（直接检索，POST）：

```bash
curl -X POST http://localhost:7369/api/knowledge/retrieve \
  -H 'Authorization: Bearer <YOUR_KNOWLEDGE_API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"query":"如何使用 LLM Wiki","knowledgeSpaceIds":["space-id"],"levels":["L0","L2"],"limit":6}'
```

示例（任务上下文）：

```bash
curl -X POST http://localhost:7369/api/knowledge/retrieve \
  -H 'Authorization: Bearer <YOUR_KNOWLEDGE_API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"taskRunId":"run_xxx","nodeId":"node_research","agentId":"agent_researcher","levels":["L0","L1","L2"]}'
```

## API Token 管理（仅系统管理员）

内部管理接口：`/api/knowledge/access-tokens`

### 创建 Token（POST）

```bash
curl -X POST http://localhost:7369/api/knowledge/access-tokens \
  -H 'Content-Type: application/json' \
  -d '{"label":"My knowledge API token","expiresAt":"2027-01-01T00:00:00.000Z"}'
```

返回会包含一次性明文 token。

### 列表（GET）

```bash
curl -G 'http://localhost:7369/api/knowledge/access-tokens' \
  --data-urlencode 'includeInactive=true'
```

### 撤销（DELETE）

```bash
curl -X DELETE http://localhost:7369/api/knowledge/access-tokens \
  -H 'Content-Type: application/json' \
  -d '{"id":"<token-id>"}'
```

返回示例：

- 搜索模式：`packet.kind = "search"`
- 任务模式：`packet.kind = "taskRun"`，包含 `health/refs/search` 等上下文。
