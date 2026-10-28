---
description: "ctx.web 的 Ollama Cloud 搜索与抓取提供方：部署方如何在一个密钥与一对实时端点之下挂载 POST /api/web_search 与 POST /api/web_fetch。"
kind: "package-reference"
---

# @deepseek-ai/dsh-web-ollama-api

[English](README.md) | 中文

## 概述

有了 `dsh-web-ollama-api`，harness 可以通过 Ollama Cloud 的 `POST /api/web_search` 搜索 web，并通过 `POST /api/web_fetch` 抓取单个网页，使用 `OLLAMA_CLOUD_API_KEY`。当部署持有 Ollama Cloud API 密钥、并希望在不消耗一次完整模型回合的前提下同时具备两个方向的检索能力时选择它。Ollama Cloud 不返回生成答案，因此搜索结果不携带 `content`——只产出可引用的来源。没有 URL 的条目会被丢弃，因此一次调用返回的来源可能少于请求数量。两个端点与搜索的结果数量都是 Ollama Cloud 搜索页面可编辑的实时设置。面向模型的 `web_search` 与 `web_fetch` 工具位于 `dsh-tool-web`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在已加载 web 服务的组合中挂载本插件。只要密钥可解析，它就注册 `ollama-cloud-search` 搜索提供方与 `ollama-cloud-fetch` 抓取提供方，因此当它是该类别中唯一可用的后端时，`ctx.web` 会自动解析到它——也可以用 `searchProvider: ollama-cloud-search` 与 `fetchProvider: ollama-cloud-fetch` 固定。两个注册都跟随凭据：存入密钥会把它们加入各提供方列表，删除密钥会把它们移出；没有密钥时，两个列表都不提供一个每次操作都会失败的后端。端点固定为 `https://ollama.com/api/web_search` 与 `https://ollama.com/api/web_fetch`，密钥使用 Ollama Cloud 模型路由保存在 `OLLAMA_CLOUD_API_KEY` 下的那一把——Ollama 就是以这种方式提供并鉴权这两项操作的。

### 何时选择

当部署持有 Ollama API 密钥——即其 Ollama Cloud 模型路由所用的那一把——并希望使用专用检索端点，而不是经由模型完成搜索或匿名的本地抓取时，选择此后端。结果数量不是正整数时搜索提供方不可用。没有密钥的部署不会注册任何提供方，运行中删除密钥会注销两者；与这次删除竞争的操作仍会以结构化的 `WEB_PROVIDER_CREDENTIAL_MISSING` 错误失败。

### 最小配置

加载 web 服务与本插件。挂载了 `ctx.credentials` 时密钥按 `OLLAMA_CLOUD_API_KEY` 从该服务解析——即 Ollama Cloud 模型路由保存的引用——否则从启动环境中的同一变量读取。两个端点都不可配置：它们就是 Ollama Cloud 的公开端点。

```yaml
- name: '@deepseek-ai/dsh-web'
- name: '@deepseek-ai/dsh-web-ollama-api'
  config:
    maxResults: 5
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxResults` | `5` | 请求不含 `maxResults` 时使用的正整数默认结果数 |

生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-web-ollama-api)是每个受支持字段及其 JSDoc 的穷尽式真源。该字段是实时的：Ollama Cloud 搜索页面通过插件条目写入它，每项操作都捕获当前值。

### 搜索返回什么

每项 Ollama 结果映射为 `WebSearchSource`：`url`、可选的 `title`，以及条目 `content` 去除首尾空白后的 `snippet`；没有 URL 的条目无可引用内容，会被丢弃。请求的 `maxResults` 优先于已配置的默认值，并作为 `max_results` 发送给 Ollama 以优化成本与延迟——最终上限由服务强制执行：截断并标记。Ollama 不返回生成答案，因此结果不携带 `content`。

### 抓取返回什么

接口在 `content` 中返回页面的 Markdown，页面无法产出内容时失败。它既不报告目标的 HTTP 状态，也不报告最终重定向 URL，因此成功的抓取报告所请求的 URL、状态码 200 与 `truncated` 为假；页面标题与 `links[]` 列表不属于共享的抓取结果，会被丢弃。

### 失败与恢复

提供方失败——HTTP 错误、网络失败、无法解析的响应体——以 `WebError` `WEB_PROVIDER_ERROR` 呈现；缺少密钥为 `WEB_PROVIDER_CREDENTIAL_MISSING`；被取消的操作呈现为 `WEB_ABORTED`。HTTP 重定向会在接触 `Location` 目标之前被拒绝，并呈现为 `WEB_PROVIDER_ERROR`。派发之后的每次失败都会指明解析出的端点，说明本包把它固定在 Ollama Cloud 的公开 API，并指向共享的 `OLLAMA_CLOUD_API_KEY` 而不是端点配置。调用方按 code 路由；面向模型的工具在自身的错误包装下把失败呈现给模型。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

本节说明这些提供方背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整覆盖。

### 设计理念

两个提供方都是 Ollama web 端点之上的薄适配层，遵循三条明确规则：

- **只产出可引用来源。** 没有 URL 的结果会被丢弃，而不是用编造的 URL 引用；`snippet` 只来自条目自身的 `content`。
- **不编造答案。** Ollama 不返回生成答案，因此省略 `content`，而不是伪造模型可能信任的提供方散文。
- **一个密钥、一个基址。** 两项操作都通过共享传输解析凭据并派发，因为 Ollama 从同一台主机提供并鉴权它们。

### 源码导图

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：实时配置 schema、环境回退、两个提供方的注册 |
| [`src/transport.ts`](src/transport.ts) | 端点解析、凭据解析、拒绝重定向的派发、取消分类、失败指引 |
| [`src/search.ts`](src/search.ts) | `OllamaSearchProvider` 及其结果映射 |
| [`src/fetch.ts`](src/fetch.ts) | `OllamaFetchProvider` |
| [`src/types.ts`](src/types.ts) | Ollama 线路类型：搜索与抓取信封，以及 `OllamaError` |

### 请求流程

`search()` 携带 bearer 密钥与 `redirect: 'error'`，把查询与结果数量 POST 到解析出的搜索端点，因此重定向会使请求失败且不接触目标；解析出的 `results[]` 逐条映射，无 URL 的条目被丢弃，服务在返回路径上施加最终的 `maxResults` 上限。`fetch()` 以同样的方式把 URL POST 到解析出的抓取端点，并返回页面的 Markdown。取消——名为 `AbortError` 的 `DOMException`——变为 `WEB_ABORTED`；其他情况变为 `WEB_PROVIDER_ERROR`。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当包级约束不够时阅读这些页面。它们从共享词汇走向服务、面向模型的工具与设计依据。

- [Web 子系统](../../../docs/subsystems/web.zh.md) — 穷尽式搜索与抓取请求／结果词汇及错误码。
- [Web 包地图](../README.zh.md) — web 包家族与各自角色。
- [dsh-web](../web/README.zh.md) — 这些提供方注册进的 web 服务。
- [dsh-tool-web](../tool-web/README.zh.md) — 渲染这些提供方结果的面向模型 `web_search` 与 `web_fetch` 工具。
- [dsh-client-ui-settings-web-search-ollama](../../client/ui-settings-web-search-ollama/README.zh.md) — 选中两个提供方并编辑端点的设置页。
- [生成的配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-web-ollama-api) — 每个受支持配置字段及其来源声明。
- [Web capability seam 决策](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.zh.md) — 为何搜索与抓取共用一个提供方选择服务。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由 `dsh-tool-web`：它保留本插件受 `maxResults` 限制的 URL、标题与页面摘录，或抓取到的页面 Markdown，并在消费者的错误包装下保留其确切的 `Ollama Cloud web request aborted`、`Ollama Cloud search request failed: <error>` 与 `Ollama Cloud returned an unprocessable response body: <error>` 失败。

#### KV Cache 影响

无直接失效；请求前缀的任何变化由上述消费者承担。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了这些提供方不适合的场景。它们是当前的包级约束。

- **没有 URL 的结果会被整个丢弃**——没有可引用的来源可映射，因此返回的来源可能少于请求数量。
- **抓取结果丢弃了接缝没有字段承载的内容**——页面标题与 `links[]` 被略过，报告的状态恒为 200，因为接口不报告目标状态。
- **只暴露两个端点与结果数量**——Ollama Cloud 的其他请求控制项等待提供方中立的服务字段。
- **取消分类基于错误形态**——只有名为 `AbortError` 的 `DOMException` 才映射为 `WEB_ABORTED`；带有自定义原因的取消呈现为 `WEB_PROVIDER_ERROR`。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：未决问题与未定方向。它明确不具权威性——已发布行为、限制与依据位于上方章节与所链接的 Agent Notes。

#### 未来：更宽的 Ollama 控制面

Ollama Cloud 的其他请求控制项仍未暴露。暴露它们需要先有提供方中立的服务字段，使本家族新增一个协调一致的控制项，而不是特定于厂商的参数。

</details>
