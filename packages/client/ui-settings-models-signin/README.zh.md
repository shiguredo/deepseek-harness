---
description: "模型页的提供方登录：基于授权 seam 的宿主 Remote，以及在提供方卡片上列出、发起、跟踪、回答和取消一次登录的区块，含浏览器在另一台机器上时的粘贴步骤。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-models-signin

[English](README.md) | 中文

## 概述

本包把提供方账号登录放到模型页的卡片上。它向 `llm-pi-ai` 家族的卡片贡献一个区块：宿主列出本组合注册的授权流程，区块发起其中之一、显示浏览器步骤，并在浏览器位于另一台机器时接收用户粘贴回来的重定向 URL。流程属于授权 seam，凭据记录属于凭据存储，两者都不写入 Session 消息。

## 目录

- [使用本包](#use-this-package)
- [预期行为](#what-to-expect)
- [实现说明](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

与 [`dsh-client-ui-settings-models`](../ui-settings-models/README.zh.md)（本包填充其 `settings.models.provider-card` 座位）以及注册授权流程的适配器一起挂载，例如 [`dsh-llm-pi-ai`](../../llm/llm-pi-ai/README.zh.md) 设置 `chatGptSignIn: true`。本包不接受配置。

宿主半边注册 `modelSignIn` Remote，浏览器半边注册字典命名空间与卡片区块。两者都是插件 fiber 的 effect，卸载插件即移除区块、面板与文案。

<a id="what-to-expect"></a>
## 预期行为

只有在该卡片处于编辑打开状态时（「添加提供商」草稿、首次运行 setup 卡片，或点过「编辑」的已保存行），卡片才显示账号区块，因此折叠的行只做摘要，无法登录或退出登录；从未启用提供方登录的组合也不会多出任何内容。折叠的行仍会携带一个事实（经由页面的行标记席位，而非本卡片区块）：当该路由由账号登录供给时，行的名称行上显示绿色的 **已通过 ChatGPT 登录** 标记。页面自身的凭据圆点代表 api-key 引用，而由计划付费的路由没有该引用，若无此标记，已就绪的路由看起来会像未配置。存在流程时，区块显示是否已存凭据以及流程第一方法的标签——OpenAI 登录为 “Continue with ChatGPT”，即 OpenAI 公布的措辞。

区块在开始前先说明浏览器步骤会要求什么，并在卡片是尚未保存的草稿时说明「保存后账号才可用」。选择后开始一次尝试并打开面板：浏览器步骤的页面、流程的通知，以及从一开始就可见的重定向 URL 输入框。该输入框就是远程路径：另一台机器上的浏览器访问的是它自己的 `127.0.0.1`，用户从地址栏复制回调 URL 粘贴到此，宿主用自己生成的 state 校验。本机浏览器通过回环回调自动完成，面板自行报告成功。

首次登录成功后保留一条确认，说明符合条件的请求使用 ChatGPT 计划，并提供指向 ChatGPT 用量设置的 **管理用量** 链接；同一浏览器中后续登录不再显示——按 OpenAI 指南，这条确认针对「账号是新的」，而非每次续期。退出登录即删除存储记录。

模型菜单承载计划行：`正在使用 ChatGPT 计划`，其下方为 **管理用量**；仅当所选模型的路由由登录授予付费时显示，否则不出现。它出现在人们已经在查看「谁在服务本次 Session」的位置——即 OpenAI 指南所配的示意图——而菜单关闭时零成本。

输入框在计划正常付费时保持沉默：在用户书写的位置重复「哪个计划为此模型付费」只是噪音。只有当计划自身的用量上限阻止请求时才发声——说明什么用完、上限可能来自计划或本应用自身的限额，并以 **管理用量** 作为解决动作，因为那正是它指向的设置页有意义的时刻。操作行下方的常驻说明写明该计划服务哪些账户（OpenAI 帮助中心列出 Go、Plus、Pro 与 Business 订阅者，Business 工作区按其自身控制设置执行），并说明登录遵循[「使用 ChatGPT 登录」条款](https://openai.com/policies/sign-in-with-chatgpt-terms/)及计划自身的额度，附指向对应界面语言页面的 **查看条款** 链接——计划、其额度以及流程请求的同意都属于 OpenAI，而不属于本包。

-----

<a id="understand-the-implementation"></a>
## 实现说明

<details>
<summary>实现内部——点击展开</summary>

一次尝试就是宿主持有的一次 `ctx.authorization.begin` 调用。Remote 以宿主生成的 id 保存该尝试，交给流程一个把通知追加到视图的 interaction，并把流程的每个提问转换为带尝试内 id 的待答问题。浏览器轮询视图；回答会带上问题 id，因此被取代的问题（粘贴与回调竞速中落败的一方）无法迟到作答。取消则撤回该 key 的 seam 尝试。

视图不携带凭据：只有通知、待答问题、阶段和失败信息。`signOut` 删除凭据记录，并在同一 key 仍有尝试时拒绝，以免迟到的提交把刚删除的记录复活。

粘贴框始终回答流程自己的 `manual_code` 提问；区块从不自行构造回调交换。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-llm-pi-ai`](../../llm/llm-pi-ai/README.zh.md) —— 注册 ChatGPT 登录流程及其安装 ID 的适配器。
- [`dsh-authorization`](../../credentials/authorization/README.zh.md) —— 能力 seam、其通知与提问，以及尝试生命周期。
- [`dsh-credentials-local`](../../credentials/credentials-local/README.zh.md) —— 流程提交的凭据记录存储。
- [`dsh-client-ui-settings-models`](../ui-settings-models/README.zh.md) —— 声明 `settings.models.provider-card`。
- [「使用 ChatGPT 登录」条款](https://openai.com/policies/sign-in-with-chatgpt-terms/) —— 本界面声明遵循的条款。
- [面向开源 app 的 Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) —— 本区块所驱动流程的开发者指南。
- [Slots 参考](../../../docs/subsystems/slots.zh.md) —— 插件如何注册到另一插件声明的座位。

-----

<a id="model-experience"></a>
## 模型体验

无。本包在授权 seam 之上呈现浏览器界面，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。提供方登录改变的是后续请求使用的凭据，而非请求内容。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了已交付界面及其有意不做的部分。

- **区块需要两半与适配器流程** —— 只有宿主半边的 `modelSignIn` Remote 已挂载且适配器注册了流程时浏览器半边才渲染；否则卡片不显示，而不是留出空的账号区域。
- **另一台机器上的浏览器需要粘贴步骤** —— 回调是宿主上的 `127.0.0.1` 回环，远程浏览器只能通过粘贴最终重定向 URL 完成；面板在输入框旁说明这一点。
- **计划行读取失败文本** —— 客户端收到的失败是消息而非代码，因此仅当报告文本包含 `subscription_sharing_usage_limit_exceeded` 时才进入上限状态。适配器自身的错误分类器同样读取提供方文本，该代码是文本中稳定的部分；以其他措辞描述该上限的失败会按普通错误显示。
- **每个提供方一次尝试** —— 同一客户端的两个标签页无法对同一记录运行两次尝试，因为 seam 会拒绝第二次；落败的标签页会看到该拒绝。
- **资格由 OpenAI 判定，而非本包** —— 帮助中心为计划用量列出 Go、Plus、Pro 与 Business 订阅者；Business 工作区在自身控制下为 Standard 与 Premium 席位支出所含额度、为按量计费席位支出工作区额度，而当所选用户、工作区或策略被拒时，请求路径会报告 `subscription_sharing_user_not_eligible`。本区块只陈述其所遵循的条款并链接到条款页，不代为复述，因此 OpenAI 一侧的变更会通过其自身页面传达给用户。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

宿主 spec 挂载真实的授权 seam 与本地凭据存储，注册一个只提一个问题的假流程，并通过 list、begin、poll、answer、cancel、signOut 驱动 Remote。浏览器半边目前没有独立 spec；模型页的 web e2e 车道覆盖区块渲染文案与它发起的流程。

</details>
