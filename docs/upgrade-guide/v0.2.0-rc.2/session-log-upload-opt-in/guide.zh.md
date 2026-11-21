---
kind: upgrade-guide
description: "DeepSeek 会话日志贡献默认关闭；如需继续上传请显式开启。"
---

# 会话日志上传改为需显式开启

[English](guide.md) | 中文

## 变更

在 v0.2.0-rc.2 中，`@deepseek-ai/dsh-session-log-deepseek` 挂载时其 `enabled` 键默认为 `true`。因此每次发往 DeepSeek 官方 API 的请求都会携带规范会话日志的一段 `dsh_session_log` 后缀，响应也会追加一条 `session-log-deepseek/delivery-accepted` 记录来推进水位。

下一个发行版将 `enabled` 的默认值改为 `false`。从未设置该键的 profile 会停止贡献该字段，也不再追加接受记录，因此依赖随附默认值的安装在升级后会悄然失去上传。显式设置 `enabled: true` 的 profile（包括 Web 开关写入的那些）行为不变，继续上传。

无论开还是关，该请求字段都只是模型输入的元数据：关闭它改变的是请求字节数，而不是模型读到的内容。

## 迁移

1. 如需继续上传，请在 Web 客户端打开**设置 → 通用 → 在使用官方模型 API 时上传 Session Log**。手工编辑 profile 时，把该行加入 `$DSH_HOME/profiles/<name>/cordis.patch.yml`：

   ```yaml
   - id: session-log-deepseek
     config:
       enabled: true
   ```

2. 接受新默认值则不要添加该行。已有的 `enabled: false` 行现在多余，可以删除。

3. 确认：重启 `dsh web`，打开设置 → 通用，若已开启则该开关应显示为打开。手工编辑的 profile 也通过同一开关确认，它显示解析后的值。
