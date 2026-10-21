# 飞猪联网接入说明

更新时间：2026-10-20

## 来源

- 官方仓库：`alibaba-flyai/flyai-skill`
- npm CLI：`@fly-ai/flyai-cli` 1.0.16
- MCP 端点：`https://flyai.open.fliggy.com/mcp`

Android 没有 Node.js 运行时，因此没有把 CLI 放进 APK。应用在 `MainActivity.java` 中实现受限的 `FlyAiApiBridge`，使用官方 CLI 所用的 streamable HTTP JSON-RPC 协议、HMAC-SHA256 请求签名和 Bearer Key。

## 允许的工具

原生桥只允许以下 MCP 工具，不能访问任意 URL、任意 RPC 方法或任意工具：

- `search_marriott_hotels`
- `get_marriott_hotel_info`
- `search_poi`
- `fliggy_ai_search`
- `search_domestic_train`
- `search_flight`

## App 内的用途

1. 地图页按用户选择的入住日期查询万豪系酒店 1 晚起价。
2. 酒店结果按规范化酒店名合并到 852 家本地目录；本地没有的新增物业以 `flyai-*` 稳定 ID 写入本机缓存。
3. 酒店详情可获取房型与公开起价、设施、政策、周边 POI 和公开评论，并保存到本机。
4. 行程页并行查询酒店、景点、直达火车或航班和飞猪 AI。
5. 高德继续负责地图、地理编码和驾车路线；飞猪结果补充酒店/景点事实与城际交通。
6. 飞猪 AI 文字单独标为“AI 生成”，不替代房态、余票、营业时间或用户评价。

## 数据边界

- `search_marriott_hotels` 返回的是公开起价、图片、坐标和预订链接，不是锁价，也未返回可核验的评论全文。
- `get_marriott_hotel_info` 可返回酒店设施、房型、政策和有限条数的公开评论；评论日期字段未返回。
- 万豪官网同步使用同一请求同时获取现金价和积分房夜数，并在酒店卡、地图选中信息和详情页分栏展示。
- `search_poi` 可返回景点介绍、等级、票务线索和坐标。
- `fliggy_ai_search` 返回生成式行程建议，必须带核验提醒。
- App 内的评论口碑仅使用已打包的飞猪、携程公开评价；用户反馈云服务尚未实现。
- 飞猪 Key、高德 Key 和 DeepSeek Key 都只适合个人侧载；公开分发前必须轮换并从安装包中移出。
- 为减少调用成本，App 会缓存酒店查询 30 分钟、景点 24 小时、AI 行程 6 小时、酒店详情 7 天；同一请求优先命中本地缓存。

## 已验证

- 飞猪官方 CLI 查询南京万豪酒店成功，返回 9 家酒店与所选日期起价。
- `search_marriott_hotels` 参数表中没有 `limit`；App 已移除该字段，修复了真实设备查价时的 HTTP 400。
- 南京景点搜索成功，返回坐标、介绍和门票线索。
- 南京“三天赏秋、少走路”语义搜索成功。
- 原生同协议的 Java HMAC-SHA256 签名 HTTP 请求返回 HTTP 200 和有效 `result`。
- 390 × 844 浏览器回归中，模拟原生桥后地图酒店合并、上海到南京火车、飞猪景点、AI 建议和高德路线均正常显示。
- 0.8.0 APK 的 DEX 中已确认存在 `FlyAiApiBridge`、`get_marriott_hotel_info`、飞猪端点和其他允许工具名单。
