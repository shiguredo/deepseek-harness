# Agent Note: message timestamps become a zone-pinned caption line

Status: implemented

[English](2026-10-06-zone-pinned-message-timestamps.md) | 中文

## Problem

Chat 此前通过共用的 IconActions 行给每条消息标注时间：用户气泡与已完成轮次页脚在复制、分支按钮旁携带一个 `HH:mm` 时钟，而该时钟与这些按钮一起，在除最后一行之外的每一行都被隐藏。由此产生三个问题。

时钟与可交互控件共处一行，只想看时间的读者必须悬停才能显示它。时钟读取进程时区，跨地区工作的读者无法把它固定到 Session 实际运行所在的时区，而该行的布局还把时钟字号与正文字号偏好绑在一起。读者在长转录中查找某事发生的时间时，只能逐行悬停，并在设备碰巧使用的时区里解读这个没有标注的时钟。

## Decision

每条消息的时间戳都是所标注消息下方的一行说明文字，由 `formatMessageClock` 经 `MessageClock` 渲染：用户与 steering 气泡、已完成轮次页脚，以及 Turn 触发通知。该行始终以完整形式写出所选时区的 `YYYY-MM-DDTHH:mm:ss`，固定时区还会在括号中标注自身（`2026-01-01T10:10:10 (JST)`），因此设备时钟与固定时区时钟不会混淆。它的字号固定为 11px 说明文字并使用三级文字色，因此在消息正文跟随 Settings 字号偏好的同时，它始终保持安静的第二层级；它没有悬停门槛，在每一行都可见。

设置 → 通用设置 → 时间戳时区以 `ui-chat.clockTimeZone` 存储 `local`（默认）、`jst` 或 `utc`，通过 `ClockTimeZonePolicy` 配置表单读取，方式与 `performance-usage.ts` 读取自己的字段相同。`ChatView` 绑定实时时区并沿 `ChatNodeOwnerProps.clockTimeZone` 向下传递，因此从 Session 日志取时间的 Node 直接渲染该时钟。Turn 触发通知保留其头部时钟，并读取同一时区。

`jst` 与 `utc` 是固定偏移，因此其墙钟取自偏移后时刻的 UTC getter；`local` 读取运行时日历，因为其偏移随夏令时变化。文本仅取决于记录的事件时间，因此时钟不订阅任何计时器，也无需在跨日时重新渲染。

复制、分支与 Turn 用量图标仍在悬停或聚焦时出现。IconActions 行用 opacity 保留其占位，因此显示图标不会移动其相邻的时钟行。`MessageIconActions` 不再接收时钟 prop；它的 `variant` prop 选择助手侧的图标尺寸。

## Alternatives considered

**保留 IconActions 行内的时钟，只增加时区设置。** 这是更小的改动，但它让时间戳继续留在悬停门槛之后、并留在为按钮定尺寸的行内——而这正是本次修改要解决的两个事实。

**像 `ui-schedule` 那样把时区当作任意 IANA 时区读取。** 调度规则确实按规则存储时区；消息时钟只需要回答「这些事各自的先后」，而自由选择器会为每条消息行引入可搜索列表、最近时区记忆和每 Session 显示时区，却不再增加任何答案。两个固定时区已覆盖本功能所需的跨地区阅读场景。

**通过带 `timeZone` 选项的 `Intl.DateTimeFormat` 格式化。** 对任意时区都正确，但它会让每条消息行构造或缓存格式化器，而两个固定时区是纯算术就能精确命名的固定偏移。

**当天只显示 `HH:mm`、跨日才加日期，并用午夜计时器把它展宽。** 之前的时钟就是这样。始终显示完整日期与时刻可以去掉计时器、参照时刻以及整类边界缺陷，代价是行更长——而该行早已读作说明文字，而不是按钮旁的时钟。

**保留简短的 `HH:mm`，只给时区加标签。** 在一次阅读中这样读起来不错，但来自不同日期的两条消息会显得相邻；把时钟单独成行的意义正在于完整时间戳。

**沿用之前 `startOfLocalDay` 那样以时刻锚定的本地日 epoch。** 现在没有任何渲染读取日 epoch：每个时钟字段都从各自的事件时间推导。

## Consequences

时钟离开图标行，因此助手页脚与用户气泡各自渲染两行而非一行；时钟位于短气泡上方的消息会多出一行装饰。固定时区会自我标注，因此设备时钟与固定时区时钟不会混淆，代价是行内多出三个字符。

跨越年份的对话现在会明确写出年份，这是此前不含年份的时钟无法做到的。日期始终存在，因此每行会比同日的 `HH:mm` 时钟多出一段文本；该行读起来是记录，而不是一瞥即知的时间。

时区偏好在回环地址浏览器中持久化，其他情况下仅在进程内生效，与 Chat 其他显示偏好的行为完全一致；它只改变呈现，绝不触碰 Session 日志。

## Testing

`packages/client/ui-chat/tests/chat-branch-tails.client.spec.tsx` 固定完整字段顺序、括号时区名背后的时区算术，以及经用户气泡与时区切换的渲染；`clock-time-zone.client.spec.ts` 与 `clock-time-zone-row.client.spec.tsx` 覆盖策略与设置行；`config.host.spec.ts` 校验新字段；`chat-apply.client.spec.tsx` 固定行顺序；`chat-font-axis-styles.client.spec.ts` 固定说明文字字号与助手图标尺寸。设置对话框的 Web e2e 黄金文件会变化，且每条消息时钟的黄金文件都因多出的日期而随之变化。
