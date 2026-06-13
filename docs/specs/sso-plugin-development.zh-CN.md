# SSO 插件开发指南

本文定义 AgentWorld 的通用 SSO 插件契约。SSO 是平台级身份能力，不允许把某个公司的登录流程写入 AgentWorld 主干代码；企业差异必须通过插件包 manifest、页面配置和 secret ref 表达。

## 1. 能力边界

AgentWorld 核心负责：

- `/api/auth/plugins/:adapterId/start`
- `/api/auth/plugins/:adapterId/callback`
- OIDC state、nonce、PKCE。
- 授权码交换、ID Token 签名校验、issuer/audience/nonce 校验。
- userinfo 拉取。
- Claim Mapping。
- 用户、团队 membership、session cookie 入库。
- 白名单和系统管理员判定。

SSO 插件负责：

- 贡献 `authAdapters`。
- 声明协议类型、能力、配置 schema 和默认 claim mapping。
- 可选贡献插件设置页、语言包、文档和示例配置。

插件不得：

- 设置 AgentWorld session cookie。
- 直接写 `identity_users`、`auth_sessions` 或其他内部表。
- 读取 `.env` 或要求 AgentWorld 注入第三方系统环境变量。
- 在 manifest 或配置中放明文 token、私钥、密码。
- 绕过 state、nonce、PKCE、JWKS 校验。

## 2. 插件包格式

插件包使用 zip 形式，扩展名建议为 `.awp`，根目录必须包含：

```text
agentworld.plugin.json
```

导入 API：

```bash
curl -X POST \
  -H "Cookie: agentworld_session=<admin-session>" \
  -F "file=@company-sso.awp" \
  http://localhost:7370/api/plugins/manifests
```

也可以直接提交 manifest JSON：

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: agentworld_session=<admin-session>" \
  --data @agentworld.plugin.json \
  http://localhost:7370/api/plugins/manifests
```

## 3. 最小 OIDC SSO 插件

```json
{
  "apiVersion": "agentworld.io/plugin/v1alpha1",
  "kind": "AgentWorldPlugin",
  "metadata": {
    "id": "company.sso",
    "name": "Company SSO",
    "version": "1.0.0",
    "description": "Company OIDC sign-in adapter."
  },
  "spec": {
    "runtime": {
      "type": "declarative",
      "entry": "agentworld.plugin.json",
      "activationEvents": [
        "onAuthStart:company.sso",
        "onAuthCallback:company.sso"
      ]
    },
    "permissions": {
      "requested": [
        "auth.oidc.exchange",
        "secret.use"
      ]
    },
    "contributions": {
      "authAdapters": [
        {
          "id": "company.sso",
          "labelKey": "plugins.companySso.name",
          "descriptionKey": "plugins.companySso.description",
          "mode": "redirect",
          "protocol": "oidc",
          "capabilities": [
            "authorization_code_flow",
            "pkce",
            "jwks_verify",
            "userinfo_sync",
            "claim_mapping"
          ],
          "defaultClaimMapping": {
            "idClaim": "sub",
            "nameClaim": "name",
            "emailClaim": "email",
            "avatarClaim": "picture",
            "titleClaim": "title",
            "employeeNoClaim": "employee_no",
            "adminClaim": "is_admin",
            "teamClaims": ["groups"]
          },
          "configSchema": {
            "type": "object",
            "properties": {
              "issuerUrl": { "type": "string" },
              "clientId": { "type": "string" },
              "clientSecretRef": { "type": "string" }
            },
            "required": ["issuerUrl", "clientId", "clientSecretRef"]
          }
        }
      ],
      "languagePacks": [
        {
          "locale": "zh-CN",
          "messages": {
            "plugins.companySso.name": "公司 SSO",
            "plugins.companySso.description": "公司 OIDC 登录入口"
          }
        }
      ]
    }
  }
}
```

导入后，`company.sso` 会进入身份认证适配器目录，并生成默认登录入口：

```text
/api/auth/plugins/company.sso/start
```

回调地址固定为：

```text
/api/auth/plugins/company.sso/callback
```

在 IdP 中登记 Redirect URI 时，应使用 AgentWorld 的外部访问域名拼接该路径，例如：

```text
https://agentworld.example.com/api/auth/plugins/company.sso/callback
```

## 4. 页面配置

导入插件后，管理员在“身份与访问”页面配置登录入口：

- Adapter：选择插件贡献的 `company.sso`。
- Issuer URL：IdP issuer。
- Authorize URL：可选；为空时核心会读取 `/.well-known/openid-configuration`。
- Token URL：可选；为空时核心会读取 discovery。
- Userinfo URL：可选；为空时核心会读取 discovery。
- JWKS URL：可选；为空时核心会读取 discovery。
- Client ID：IdP 分配的客户端 ID。
- Client Secret Ref：secret ref 或页面配置中的安全引用；不得使用 `env:`。
- Scopes JSON：默认 `["openid", "profile", "email"]`。
- Claim Mapping JSON：把 IdP claims 映射到 AgentWorld 身份字段。
- Extra Config JSON：可放 OIDC 元数据覆盖项和客户端认证方式。

推荐 Extra Config：

```json
{
  "clientAuth": "client_secret_post"
}
```

支持的 `clientAuth`：

- `client_secret_post`
- `client_secret_basic`

## 5. Claim Mapping

```json
{
  "idClaim": "sub",
  "nameClaim": "name",
  "emailClaim": "email",
  "avatarClaim": "picture",
  "titleClaim": "title",
  "employeeNoClaim": "employee_no",
  "adminClaim": "is_admin",
  "teamClaims": ["groups"]
}
```

映射结果：

- `idClaim` -> `identity_users.external_user_id`
- `emailClaim` -> `identity_users.email`
- `nameClaim` -> `identity_users.name`
- `avatarClaim` -> `identity_users.avatar_url`
- `titleClaim` -> `identity_users.title`
- `employeeNoClaim` -> `identity_users.employee_no`
- `teamClaims` -> `identity_user_business_team_memberships`

`teamClaims` 可以是字符串数组：

```json
{
  "groups": ["platform", "security"]
}
```

也可以是对象数组：

```json
{
  "groups": [
    { "slug": "platform", "roleTitle": "Engineer", "isPrimary": true },
    { "slug": "security", "roleTitle": "Reviewer" }
  ]
}
```

AgentWorld 会按 `businessTeamId`、`teamSlug`/`slug`、`teamName`/`name` 查找已有业务团队；找不到的团队不会自动创建。

## 6. 安全约束

- 核心会为每次登录生成一次性 `state`、`nonce` 和 PKCE verifier。
- `state` 默认 10 分钟过期，回调用过即标记为 used。
- ID Token 必须通过 JWKS 校验，当前核心托管 OIDC 支持 RS256、RS384、RS512。
- `aud` 必须匹配 Provider 的 Client ID。
- `iss` 必须匹配 Issuer URL 或 discovery issuer。
- `nonce` 必须匹配本次登录生成的 nonce。
- token、secret、authorization code 不会写入用户 profile。
- 原始 claims 会写入 `profile_json.ssoClaims`，用于后续人员信息排查和知识沉淀。

## 7. 验证清单

1. 上传 `.awp` 后，`GET /api/plugins/manifests` 能看到插件 manifest 和 `authAdapter` contribution。
2. 身份与访问页面的 Adapter 下拉框能看到插件贡献的适配器。
3. 新增登录入口并绑定该 Adapter。
4. 开启 SSO 登录，选择 SSO 插件。
5. 登录页点击 SSO 按钮后跳转到 IdP。
6. IdP 回调 `/api/auth/plugins/:adapterId/callback` 后，AgentWorld 设置 `agentworld_session`。
7. `identity_users` 中出现 SSO 用户，`profile_json.sso.providerId` 指向登录入口。
8. 如果 claim 中带团队，已有业务团队会生成 membership。
9. 未命中白名单的用户只能进入受限访问路径，不能绕过团队可见范围。
