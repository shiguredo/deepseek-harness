---
description: "Ollama Cloud 网页提供方在 dsh Web 客户端 Plugins 页上的设置页：本部署是否使用它、API Key、每项操作到达的端点，以及默认结果条数。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-web-search-ollama

[English](README.md) | 中文

## 概述

在侧边栏打开 **Plugins**，在 Official 分组中选择 **Ollama Cloud 搜索**，即可决定本部署是否通过 Ollama Cloud 进行搜索与抓取，并设置该提供方的密钥、两个端点，以及搜索使用的结果条数。页面只暂存输入，点击保存才写入；被用户覆盖的值会标注，并可逐个恢复为部署默认值。密钥通过凭据域写入，不写进设置文件，因此其明文不会随响应传输。只要 Host 提供 `web-ollama-api` 命名空间，该页面就存在。

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

Official 分组中的 **Ollama Cloud 搜索** 卡片打开该页面，页面由开关、三个字段和一个密钥组成。

**网页搜索与抓取都使用 Ollama Cloud** 把 `web.searchProvider` 与 `web.fetchProvider` 一并写入。开启即选中 `ollama-cloud` 与 `ollama-cloud-fetch`，若组合层已是它们则清除覆盖。关闭同样清除覆盖，使本部署自己的选择重新生效；只有组合层本身就是 Ollama Cloud 这一对时，才改写为随附的 DeepSeek 与本地 HTTP id——这是本页唯一还能叫出名字的另一种选择。只有当 Host 同时提供 `web` 与 `web-ollama-api` 两个命名空间时，开关才会出现。

**API Key** 每次加载都从空白开始，只报告是否已配置密钥；留空会保留已存储的密钥；当凭据无法在此写入时（例如密钥由进程环境提供），该控件会被禁用。它寻址 `OLLAMA_CLOUD_API_KEY`，或该配置项声明的 `apiKeyEnv`。

**搜索 API 地址** 与 **抓取 API 地址** 显示生效值，为空时以淡色显示各项操作回退到的端点——`https://ollama.com/api/web_search` 与 `https://ollama.com/api/web_fetch`——清空后保存即恢复组合层默认值。若填写的值只到共用基址，提供方会追加上该项操作的路径，因此 `https://ollama.com` 与完整 URL 都被接受。

**每次搜索结果数** 是调用方未自带上限时提供方发送的条数；调用方给出更小的上限时仍以更小者为准。

点击 **保存** 之前不会写入任何内容；离开页面会丢弃草稿，非数字文本会阻止保存并在字段下方说明原因。未提供选择项时字段仍可编辑，此时开关隐藏。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

Host 半部分是一个空的 `apply`，其存在只是为了让该包拥有一个 Loader 行，供客户端模块系统为其提供浏览器半部分。浏览器半部分通过 `ctx.configForms.get` 绑定已组合的 `web-ollama-api` 配置项与 `web` 选择，用 `OllamaSearchCardController` 在 `ui-primitives` 共享的 `SettingsFormModel` 之上维护两份暂存表单，并通过 `ctx.configForms.whileServed` 把 `OllamaSearchCard` 注册进 Plugins 页的 `plugins.shiguredo` 槽位（实验性之后的分组）：Host 提供该提供方配置项时注册，停止提供时撤回。选中两个提供方时写入 `web` 配置项；两个端点、结果条数与密钥写入提供方配置项，且保存时先写提供方配置项，使开关永远不会指向尚未落地的端点。密钥是这些表单唯一的秘密控件：写入走 `remote.credentials.set`，寻址该配置项声明的引用；已配置状态从 `remote.credentials.describe` 读回，并在 Host 针对该引用报告 `credentials/reference-updated` 时重新读取。页面文案位于本包的 `settings.webSearchOllama` 字典；`SettingsForm` 框架以 props 接收自己的文案。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [ui-plugin-manager](../ui-plugin-manager/README.zh.md)——插件页以及本页注册进去的 `plugins.shiguredo` 槽位。
- [ui-settings](../ui-settings/README.zh.md)——本页依赖的设置作用域与已提供命名空间监听。
- [ui-primitives](../ui-primitives/README.zh.md)——本页渲染的设置表单模型与字段。
- [credentials](../../credentials/README.zh.md)——密钥写入所经过的凭据引用接缝。
- [web-ollama-api](../../web/web-ollama-api/README.zh.md)——注册 `web-ollama-api` 命名空间与两个提供方 id 的提供方。
- [ui-settings-web-search](../ui-settings-web-search/README.zh.md)——DeepSeek 搜索提供方自己的页面，以相同方式暂存其选择。

-----

<a id="model-experience"></a>
## 模型体验

无。本包是浏览器侧设置界面，不注册任何模型可见面。

#### KV 缓存影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **页面只编辑所提供 schema 的子集** — `apiKeyEnv` 是部署拥有的凭据引用，页面读取它来寻址密钥，但不提供控件；`apiKey` 只通过凭据域呈现。
- **开关只能叫出两种选择** — 它要么写入 Ollama Cloud 的 id，要么清除覆盖，因此组合层本身就是 Ollama Cloud 这一对的部署无法从本页表达第三种状态。
- **只有该提供方拥有页面** — Exa 与 Perplexity 仅通过各自的组合配置项配置，因为没有产品需要为每个可选提供方重复本包。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
