---
kind: upgrade-guide
description: "Ollama Cloud 网页搜索提供方改为以 ollama-cloud-search 注册，端点与密钥不再是配置项。"
---

# Ollama Cloud 网页提供方的 id 与配置

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-web-ollama-api` 将其搜索提供方由 `ollama-cloud` 改为 `ollama-cloud-search` 注册，使它注册的两个 id 都像 `ollama-cloud-fetch` 那样写明各自能力。抓取 id 不变。`ollama-cloud` 同时是 `llm-pi-ai` 聊天路由的名称，因此 web 接缝不再复用该 id。

两个端点与 API Key 不再是配置项。两项操作分别到达 `https://ollama.com/api/web_search` 与 `https://ollama.com/api/web_fetch`，并使用 Ollama Cloud 模型路由已保存的 `OLLAMA_CLOUD_API_KEY` 鉴权；只要该密钥可解析，插件就注册其提供方。`apiKey`、`apiKeyEnv`、`searchBaseURL`、`fetchBaseURL` 四个字段已移除，仅保留 `maxResults`。Ollama Cloud 搜索设置页现在只有开关与结果条数，并报告共享密钥是否可解析。

允许自动选择提供方的部署无需改动。而通过 profile patch、`cordis.yml` 或 overlay 设置 `web.searchProvider: ollama-cloud` 的部署会失效：网页搜索与获取页显示 `ollama-cloud (not loaded)`，且在改名为新 id 之前 `web_search` 以 `WEB_PROVIDER_CONFIGURED_MISSING` 失败。插件不再声明的字段会被忽略而不是拒绝，因此残留的 `apiKeyEnv` 不改变任何行为，却会掩盖密钥现在只在 `OLLAMA_CLOUD_API_KEY` 下解析这一事实。

## 迁移

1. 在所有设置 `web.searchProvider` 的 profile patch、`cordis.yml` 和 overlay 中，把 `ollama-cloud` 替换为 `ollama-cloud-search`。
2. 从 `web-ollama-api` 行删除 `apiKey`、`apiKeyEnv`、`searchBaseURL`、`fetchBaseURL`。部署若设置过 `maxResults` 则保留。
3. 确认 `OLLAMA_CLOUD_API_KEY` 能在凭据存储或启动环境中解析；没有它，web 提供方不会注册。
4. 在网页搜索与获取页上，凡是仍指向旧 id 的已存选择，重新选择 Ollama Cloud 一项，然后执行一次 `web_search` 并确认成功。
