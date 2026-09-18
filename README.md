# dsh-theme-presets

DSH Web GUI 的主题预设插件：在内置的 **浅色 / 深色 / 跟随系统** 之外，再叠一层**配色家族**。

## 安装

在 DSH 的插件安装界面里填本仓库地址：

```
git@github.com:MicroSharpAnt/DSH-simple-theme-plugin.git
```

或 HTTPS 形式 `https://github.com/MicroSharpAnt/DSH-simple-theme-plugin.git`
（安装走 pnpm，两种都能识别）。

**安装后无需构建**：浏览器端 bundle `lib/client.js` 是随仓库提交的产物。
这一点是刻意的——pnpm 默认拦截依赖的构建脚本（`ERR_PNPM_IGNORED_BUILDS`），
如果产物要靠 `postinstall` 生成，安装方还得额外批准 `allowBuilds`，
多一道容易失败的坎。

本包**没有任何运行时依赖**。

## 用法

**设置 → 通用 → 主题预设**，点一个色块。

- 预设只决定**配色家族**，明暗仍由上一行的「外观」控制，两者正交。
  选了 Nord 之后，「浅色」= 它的 Snow Storm，「深色」= Polar Night，
  「跟随系统」则跟着系统在两者之间切。
- 每个色块显示当前明暗模式下该预设的底色 / 强调色 / 正文色，会随「外观」一起变。
- **默认** = DSH 自带配色，不做任何覆盖。
- 选择写进 settings 的 `theme-presets.preset`（`~/.dsh/settings.yaml`），跨刷新、跨重启保留。

## 八个预设

| id | 名称 | 浅色变体 | 深色变体 |
| --- | --- | --- | --- |
| `nord` | Nord | Snow Storm | Polar Night |
| `dracula` | Dracula | Alucard | Dracula |
| `catppuccin` | Catppuccin | Latte | Mocha |
| `tokyonight` | Tokyo Night | Day | Night |
| `onedark` | One Dark | One Light | One Dark |
| `gruvbox` | Gruvbox | Light | Dark |
| `solarized` | Solarized | Light | Dark |
| `github` | GitHub | Light | Dark |

配色取自各主题自己发布的调色板，不是凭印象配的近似值；
每个主题的 15 个语义锚点（底色 / 表面 / 文字 / 边框 / 强调 / 四种状态）
定义在 `presets.mjs`，其余 92 个 `--dsw-alias-*` token 由统一的
`deriveTokens()` 用 `color-mix()` 从这些锚点派生，所以不存在手抄 8×2×86 个值。

## 工作原理

三层按时间顺序接管同一批 `--dsw-alias-*`，交接处不跳变：

1. **首屏——宿主端注入（无闪烁）**
   `host.js` → `src/plugin.mjs` 监听 `webserver/index-inject`，在每次 index 响应里加两条：

   - head 一条 CSS：
     `html body[data-dsh-theme-preset="nord"]{…浅色 token…}`
     `html body[data-dsh-theme-preset="nord"][data-ds-dark-theme]{…深色 token…}`
   - body 一个脚本：给 `<body>` 打上 `data-dsh-theme-preset="nord"`

   两条规则都写成 `(0,1,2)` 特异性，压过基础样式表的
   `body[data-ds-dark-theme]`，同时**刻意不用 `!important`**——那会连第 2 层
   的 inline 覆盖一起挡住。body 注入行紧跟 `<body>` 开标签、按激活顺序排列，
   所以 ui-theme 的 boot 脚本（设 `data-ds-dark-theme`）先跑，随后深色规则生效；
   属性一旦打上，CSS 是回溯匹配的，两个脚本谁先谁后都不影响结果。

2. **接管**
   浏览器端 `lib/client.js` 加载后调 `ctx.theme.overrideTokens()`，
   ui-layout 的 presenter 把这些 token 写成 **inline 自定义属性**（优先级高于
   任何样式表），同时移掉第 1 层那个属性。这一步等 settings 解析完才做：
   在 `loading` 期间先按兵不动，否则会先把预设抹掉、等值到了再刷回来，
   那正是这个插件要消灭的闪烁。

3. **切换**
   只替换 override 层——不重载页面、不重新注册主题。
   上游的 `setTheme('<第三方 id>')` 是不持久化的（`isThemePreference` 为 false），
   所以预设走 override 通道而不是注册新主题 id。

第 1、2 层的值同出 `presets.mjs` 一份数据，所以交接处像素级一致。

## 改配色

`presets.mjs` 是唯一数据源，改完分两条路走。

**浏览器端**（设置行的色块、切换后的即时配色）：

1. 改 `PRESETS` 里某个预设的 `light` / `dark` 锚点（各 15 个颜色），或整段新增一个预设；
2. `node build-client.mjs` 重新生成 `lib/client.js`；
3. 浏览器刷新。`dsh-client-hmr` 会重新取产物并更新 rev，一般不用额外操作。

**宿主端**（刷新时的首屏注入）：

4. 把 `cordis.patch.yml` 里 `theme-presets` 的 `config.revision` 加一，保存。

   `presets.mjs` 会按 mtime 重新载入，所以**只调配色不需要重启**。

   注意：`src/plugin.mjs` 和 `host.js` 是**静态导入**的（原因见下一条），
   改这两个文件后光加 revision 未必生效——**最稳妥的做法是重启 dsh web**。

`lib/client.js` 要单独构建，是因为浏览器端拿不到文件系统，palette 数据必须
在构建时内联进 bundle；宿主端则每次 index 渲染现读 `presets.mjs`。

## 宿主端的四个约束

前三个是 DSH 插件加载机制造成的，与本插件无关，但改代码时一定会撞上；
第四个是本插件自己的一条硬性要求。

1. **settings 的注册必须同步完成，不能跨 `await`。**
   这是最难发现、也最容易被无意破坏的一条。客户端的 settings mirror 只在
   **启动时**读一次 `settings.describe`，之后只在文档变更或连接重置时才重读。
   比这次读取更晚注册的 namespace **再也不会被 describe**，于是浏览器端的
   scope 永远停在 `status: 'loading'`，而浏览器半**刻意等到 `ready` 才接管**——
   结果是：设置行正常显示、点击切换也正常，但**刷新后首屏注入不会被接管**，
   看起来就像"预设没生效"。
   所以 `apply()` 里注册 namespace 的那几行必须在**第一个 `await` 之前**，
   `host-test.mjs` 里有一条断言专门钉住这个行为（它在同步阶段就检查注册已完成）。

2. **同路径的模块会被 ESM 缓存。**
   cordis 重载时按绝对路径 `import()` 插件，而 Node 对重复的 specifier 直接返回
   缓存模块——所以**改了被静态导入的源码，进程里跑的仍然是旧代码**。
   本插件的取舍是：只有 `presets.mjs`（用户真正会调的文件）走 mtime 动态载入，
   `host.js` 与 `src/plugin.mjs` 为了满足第 1 条而静态导入，代价是改它们要重启。

3. **patch 条目按 `id` 做 diff，改 `name` 不生效。**
   只改注释不触发重载；改 `name` 也**不会**换用新路径，实测仍旧加载缓存里的旧模块。
   要让条目真正卸载重装，得先把整个 `- insert:` 块删掉保存，再加回来保存。

4. **`package.json` 的 `dsh.client.inject` 只在进程启动时解析。**
   HMR 只重建 bundle、不重读 package.json（`graphRow(id, rev, record.meta)`
   沿用旧 meta），所以改了那几项要重启才更新。
   它只影响加载顺序、不影响功能：真正的依赖由 bundle 里 `exports.inject`
   的服务名（`theme` / `slots` / `locale` / `settingsScope` / `remote`）保证，
   cordis 会等到服务出现才 apply。

## 为什么自带一份 schema

`settings.register()` 需要一个含 `toJSON()` 的 schemastery schema。而
`@deepseek-ai/schemastery` 是 dsh 仓库内的私有包（内部一律 `workspace:^` 引用，
未发布到任何 registry），**从 git 安装的插件无法依赖它**。

settings 只用到 schema 的两件事：调用它做校验+补默认值，以及读 `toJSON()`
描述形状。所以 `src/schema.mjs` 自己实现了这个小接口。

有一个必须注意的细节：`toJSON()` 的输出**必须与 schemastery 的引用表格式结构一致**
（`{uid, refs}`，其中 `union.list` 放的是**数字引用**而不是字面量），因为客户端会
拿它去 `new Schema(envelope)` 重新水合。早期版本输出的是等价的扁平对象，
结构上"看起来更清楚"，但**在客户端解码时被拒**，症状就是上面第 1 条描述的那样静默失效。
`schema-test.mjs` 因此断言的是引用表结构本身，而不是它的语义。

## 测试

```sh
node build-client.mjs   # 或 npm run build
npm test                # 五个套件，共 107 项检查，不需要运行中的 dsh
node e2e-test.mjs       # 可选：真实浏览器里的端到端验证，22 项
```

| 套件 | 覆盖 |
| --- | --- |
| `verify-contract.mjs` (15) | 复现 dsh 的客户端发现链路：包名、`dsh.client`、`./client` 导出形状、bundle id 与 package name 一致 |
| `schema-test.mjs` (21) | 自带的 settings schema：校验与默认值、未知 id 回退、`toJSON()` 输出能被 schemastery 重新水合 |
| `self-test.mjs` (19) | 浏览器端逻辑：接管时机（loading 期不接管）、92 token 覆盖、切换与持久化、未知 id 回退 |
| `host-test.mjs` (41) | 宿主端：**注册必须发生在同步阶段**（见下）、schema 校验、首屏注入的选择器 / 特异性顺序 / 两条规则的值 |
| `bundle-test.mjs` (11) | 执行**真实产物** `lib/client.js`：注册形状、只 require `react`、导出面、内联数据完整 |
| `e2e-test.mjs` (22) | 真实浏览器（playwright + 本机 Chrome）：设置行出现、9 个选项、切换后浏览器端接管、持久化、重载后首屏层先绘制、两层取值一致、无 console 报错 |

前五个套件都在进程外跑，只有 `e2e-test.mjs` 会连真实 GUI —— 因此它**不在
`npm test` 里**：需要**运行中的 `dsh web`**（token 从
`<checkout>/.dsh-build/recovered-service.log` 读）、本机 Google Chrome，以及
dsh 检出里的 playwright。它在结束时会**恢复进入时的那个预设**，所以不会改掉你的选择。
dsh 检出不在默认位置时用 `DSH_CHECKOUT=/path/to/dsh` 覆盖。

## 目录

```
host.js             宿主入口：同步注册 namespace，接线首屏注入
src/plugin.mjs      宿主端实现：注入行的构造（静态导入，不可跨 await 注册）
src/schema.mjs      自带的 settings schema（无外部依赖）
presets.mjs         唯一数据源：8 个预设的锚点色 + deriveTokens()
src/runtime.mjs     浏览器端源码（自包含函数，构建时内联进 bundle）
build-client.mjs    生成 lib/client.js
lib/client.js       构建产物，随仓库提交（浏览器实际加载的东西）
lib/client.d.ts     产物类型声明
e2e-test.mjs        可选：真实浏览器端到端验证
verify-contract.mjs / schema-test.mjs / self-test.mjs / host-test.mjs / bundle-test.mjs
                    进程外的测试套件
```
