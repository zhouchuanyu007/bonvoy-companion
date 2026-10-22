# 后端代理与密钥迁移指南

当前公开 APK 是无密钥版本。要让公开 APK 恢复完整联网能力，推荐把供应商密钥放到自有后端，客户端只保存后端地址和短期用户令牌。

## 目标架构

```text
Android App
  -> HTTPS API Gateway / BFF
      -> Marriott official search adapter
      -> Fliggy / FlyAI adapter
      -> Meituan travel Skill adapter
      -> AMap REST adapter
      -> DeepSeek adapter
  -> Redis / PostgreSQL / object storage for cache and snapshots
```

客户端不得直接持有高德 Web 服务 Key、DeepSeek Key、飞猪 Key、美团 Token 或签名 Secret。

## 建议接口

- `POST /v1/auth/device`：设备注册并领取短期 access token。
- `GET /v1/marriott/hotels`：按城市、坐标、日期获取酒店与现金/积分价。
- `GET /v1/marriott/hotels/:id`：酒店详情、房型、设施、评价摘要。
- `POST /v1/meituan/travel`：输入城市、兴趣、节奏和备注，返回景点与餐厅结构化结果。
- `GET /v1/amap/geocode`、`GET /v1/amap/weather`、`POST /v1/amap/routes`：高德代理。
- `POST /v1/deepseek/plan`：仅接收已校验事实并返回最终攻略。
- `GET /v1/promotions/points`：返回有来源和有效期的额外积分活动。
- `GET /healthz`、`GET /metrics`：健康检查与监控。

所有接口应限制请求体大小、字段类型、城市范围和频率。不要提供任意 URL 转发、任意供应商主机或原始密钥透传接口。

## 环境变量示例

后端使用自己的秘密管理而不是把值写进 Git：

```env
PORT=8080
APP_BASE_URL=https://api.example.com
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...

MARRIOTT_BASE_URL=https://www.marriott.com.cn
FLYAI_MCP_URL=https://flyai.open.fliggy.com/mcp
FLYAI_API_KEY=...
FLYAI_SIGN_SECRET=...
MEITUAN_TRAVEL_URL=https://mcp-open-cater.meituan.com/v1/api/voyage/openapi/query
MEITUAN_TRAVEL_KEY=...
AMAP_REST_KEY=...
DEEPSEEK_API_KEY=...
```

生产环境建议把 Key 放进云厂商 Secret Manager、Kubernetes Secret 或 Docker Swarm Secret，不放入镜像和仓库。

## 推荐实现

- API 服务：Node.js + NestJS/Fastify，或 Python + FastAPI。
- 数据库：PostgreSQL 保存目录、价格快照、详情和活动有效期。
- 缓存：Redis 保存高德地点、天气、酒店搜索和 AI 结果，设置短 TTL。
- 队列：Redis/BullMQ 或 Celery 处理全城补价、详情采集和评价同步。
- 部署：Docker + Caddy/Nginx + HTTPS；需要中国境内稳定访问时选择合规云服务器并完成备案。
- 监控：结构化日志、请求耗时、供应商错误率、配额消耗和告警。

## 鉴权与防滥用

1. App 首次启动调用 `/v1/auth/device`，服务端签发 30–60 分钟短期 JWT。
2. JWT 只包含设备 ID、过期时间和最小权限，不包含供应商 Key。
3. 每个设备设置每日配额，服务端按 IP、设备、接口做限流。
4. 对异常批量查询、自动遍历城市、代理转发和重复请求进行封禁。
5. 供应商 Key 只存在于后端进程内存或 Secret 环境变量。
6. 日志强制脱敏 `Authorization`、Cookie、Key 和用户备注。

## 高德地图的特殊处理

高德 Web JS SDK 必须在浏览器/WebView 中初始化，因此需要客户端 Key。应创建专用 Web 端 Key，并配置域名白名单；不要把当前的无限制服务端 Key 暴露给客户端。

酒店查询、地理编码、天气和路线等 REST 请求全部走后端代理，客户端只加载受域名限制的地图 JS Key。

## Android 改造步骤

1. 把 `MainActivity` 中的供应商桥替换为统一的 `AndroidBackendApi`。
2. 只保留一个 `API_BASE_URL` BuildConfig 字段。
3. 用短期 JWT 调用 `/v1/marriott/*`、`/v1/meituan/*`、`/v1/amap/*` 和 `/v1/deepseek/*`。
4. 删除 `AMAP_KEY` 以外的供应商 Key BuildConfig 字段。
5. 增加网络错误、额度耗尽、登录过期和离线回退状态。
6. 在 Keyless 构建中继续只启用本地目录、收藏、对比、榜单和本地详情。

## 部署检查清单

- 只在 HTTPS 提供服务。
- 健康检查和自动重启已配置。
- 数据库与 Redis 不暴露公网。
- CORS 只允许自己的 H5 域名。
- 日志中没有 Key、Token 或用户敏感备注。
- 每天检查供应商配额和错误率。
- Key 轮换流程和紧急禁用开关已经演练。
- 公开 APK 中搜索不到任何供应商密钥。

