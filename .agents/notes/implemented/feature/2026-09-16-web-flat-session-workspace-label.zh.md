# Agent Note: Web 单列表会话行的 Workspace 标签

Status: implemented

[English](2026-09-16-web-flat-session-workspace-label.md) | 中文

## 问题

Workspace 浏览器提供两种浏览模式。分组模式用各自的标题行命名每个 Workspace。单列表（**In one list**）模式把每个 Session 画成一条无层级的行，只带状态、标题与更新时间，于是来自不同 Workspace 的 Session 变得无法区分：行上不再写明它属于哪个 checkout、项目或工作目录，而唯一会写出 Workspace 名字的界面——搜索结果——并不是浏览视图。

## 决策

`deriveFlat` 把所属 Workspace 的标题投影到每条扁平 `SessionNode` 上，找不到 Workspace 时回退到 Session 的目录基本名，因此扁平投影给出与搜索投影相同的标签。扁平行把这个标签渲染为 11px 的第三级文字，位于会话标题上方，构成两行单元格；标签为空时改为渲染本地化的 **未分组**。分组行保持单行单元格，因为其分组标题已经命名了 Workspace；扁平行则从分组的 32px 单元格增高到最小 45px，为第二行留出空间。该标签只是展示数据：不移动任何 Session、不改变顺序、也不带来任何 Workspace 变更。

## 测试

tree spec 证明归属投影（Workspace 标题、目录回退、空标签，以及多个 Workspace 同时归属一个 Session 时取第一个标题）；row spec 证明标签位于标题上方、未分组回退会渲染、扁平行仍省略状态槽；browser spec 证明切换到单列表后名称、顺序与拖拽行为不变且每行都显示其 Workspace；style spec 固定扁平行的最小高度。该改动对模型与 wire 不可见，因此没有 snapshot 或 session 日志 fixture 变化。

## 备选方案

- **在时间旁附加 Workspace 读数。** 否决：14px 标题与尾部时间已经争用同一行，为了容纳标签而截断标题会隐藏这一行存在的文本。
- **在单列表中插入 Workspace 分隔行。** 否决：最近更新顺序会让 Workspace 交错出现，分隔行会不可预测地重复；手动拖拽顺序还会多出拖拽模型并不处理的合成行。
- **只放在 hover 卡片里。** 否决：hover 做不到一眼可见，而 Workspace 需要在浏览时就能读到。
- **为插件提供逐行 slot。** 否决：该标签是本包已经派生出的数据；逐行的 session 作用域 slot 需要每行一个作用域绑定，而且占据者仍然需要把标签投影进行内。
- **只在 Workspace 与上一行不同时命名。** 否决：行会时有时无地省略这一事实，使读数取决于滚动位置。

## 后果

- 扁平行更高（最小 45px，对比 32px），侧边栏可容纳的行数因此减少。
- 同一 Workspace 的连续行会重复其标签；重复是刻意的，因为隐藏它会让读数取决于滚动位置。
- 分组浏览、计数、排序与拖拽行为不变；标签只影响展示，prompt、事件、schema 与 KV cache 都不改变。
