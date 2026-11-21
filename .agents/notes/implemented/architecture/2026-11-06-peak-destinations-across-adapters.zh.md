# Agent Note：peak 目的地可以运行在另一适配器的路由上

Status: implemented

[English](2026-11-06-peak-destinations-across-adapters.md) | 中文

## 问题

部署为了避免 Ollama Cloud 的高峰价，会把这些时段改发往另一家提供方，而那家提供方常常已经通过自己的适配器配置好了：`deepseek-official` 带着 Messages 协议、in-history 系统提示模式、addition-only 工具更新模式，以及该路由已经解析的凭据引用。[高峰提供方替身](2026-10-03-peak-provider-alternates.zh.md)决策只接受已安装的 pi-ai 提供方，因此该路由在加载时被拒绝，而 Models 页面却把它列为目的地；当时允许的唯一 DeepSeek 目的地是 pi-ai 自带的 `deepseek` 目录路由。该路由使用 OpenAI Chat Completions，且目录没有为 `deepseek-flash` 声明对话中系统消息支持，因此 agent loop 每一步都会重写开头的系统提示，提示缓存前缀无法复用——这正与以节省成本为目的的窗口相悖。

## 决策

`peak` 目的地是两者之一。

- 已安装 pi-ai 目录描述的路由留在 `dsh-llm-pi-ai` 内。快照按目录模型物化它，并在没有路由声明它时构造默认执行 profile，且加载时仍会检查它必须提供的模型。
- 其他目的地都点名部署注册的路由。`PiAiAdapter.alternateRoute()` 把该路由与它将收到的模型交给 `LlmRuntime`，由后者解析提供方的注册，并经拥有它的适配器分派调用。`dsh-llm` 的 `LlmAdapter.alternateRoute()` 就是这个 seam：执行路由的适配器拥有端点、协议、模型与凭据，因此配置会拒绝此类目的地上的窗口 `apiKeyEnv`。

请求的提供方与模型仍是该调用的身份。`LlmRuntime.prepareCall()` 与直接调用 `stream()` 在适配器 I/O 之前解析一次分派目标，报告请求的提供方、模型与重试策略，并从执行路由返回的元数据中取上下文、模态与对话更新模式。传给执行适配器的请求以其路由的提供方与模型命名，因为每个适配器都从请求中读取自己的路由；而调用方的配置、记录中的 `request/header` 与模型选择器保留配置路由。

配置接受任何非空目的地。设置写入还会检查已安装目录未描述的目的地在当时是否已注册；YAML 加载无法做这项检查，因此缺失的路由会在首次请求时以 `NO_ADAPTER` 失败，并点名两条路由。Models 页面只提供已配置且已注册的提供方，因此现在可以提供原生的 `deepseek-official` 行。

## 考虑过的替代方案

- **把窗口指向 pi-ai 的 `deepseek` 目录路由**——旧设计唯一允许的 DeepSeek 目的地。它用同一把密钥访问同一 API，但经由 OpenAI Chat Completions：已安装目录把 `deepseek-flash` 标记为不支持对话中系统消息，因此每一步都会重写开头的系统提示，提示缓存前缀随之失效。
- **把分派留在 `dsh-llm-pi-ai` 内，由它调用另一个适配器**——适配器无法访问注册表；而调用 `ctx.llm.stream()` 会把 `llm/stream` waterfall 跑两遍，对一次请求重复触发 checkpoint 与标题 listener。
- **要求所有目的地（包括目录目的地）都必须是已注册路由**——做法统一，但目录替身（例如带环境凭据的 `opencode-go`）就需要自己的 profile，并在选择器里多出一个分组。拆成两条路径则不改变现有目录行为。
- **把全部高峰路由移入 `dsh-llm`**——窗口数据、内置价格政策与目的地校验都属于 pi-ai 适配器；服务层将不得不学习某一种适配器族的词汇。

## 后果

- 在另一适配器路由上执行的请求会从提供方中立历史开始：replay 状态属于产生它的适配器，当执行适配器与消息的来源提供方不同时，`LlmRuntime.forAdapter()` 会剥离它。因此该窗口内的每次请求都开启新的前缀。
- 重试策略仍是请求路由的。恢复遵循操作者选定的路由，而不是窗口期间恰好执行的那条。
- 被释放或从未注册的目的地路由会在最早可解析点以 `NO_ADAPTER` 使调用失败；设置写入会在持久化之前拒绝它。
- 高峰路由仍然只记录配置路由，因此实际处理请求的后端只能在该提供方自身的记录中看到。
