# dsh-theme-presets

DSH Web GUI 的主题预设插件：在内置的 **浅色 / 深色 / 跟随系统** 之外，再叠一层**配色家族**。

## 安装

在 DSH 的插件安装界面里填：

```
https://github.com/MicroSharpAnt/DSH-simple-theme-plugin.git
```

**不要用 `git@github.com:...` 这种 scp 语法。** 它虽然能被 DSH 的预检接受
（`install-spec.ts` 的 `GIT_URL` 正则认得 `git@host:`），却会被 pnpm 按 `name@range`
拆成「包名 `git` + 版本 `github.com:...`」，于是装出一个**悬空的 `node_modules/git`
软链**，实际什么都没装上——日志特征是 `added 0` 和 `+ git link:github.com:...`，
而 profile 的 `dependencies` 与 `dsh.profile.bundles` 都不变。

同样有效的写法：`github:MicroSharpAnt/DSH-simple-theme-plugin`、
`git+ssh://git@github.com/MicroSharpAnt/DSH-simple-theme-plugin.git`。

**安装后无需构建**：浏览器端 bundle `lib/client.js` 是随仓库提交的产物。
这一点是刻意的——pnpm 默认拦截依赖的构建脚本（`ERR_PNPM_IGNORED_BUILDS`），
如果产物要靠 `postinstall` 生成，安装方还得额外批准 `allowBuilds`，
多一道容易失败的坎。

本包**没有任何运行时依赖**。

包通过 `dsh.bundle.patch` 声明自己的宿主层（见 `cordis.patch.yml`）。**这个声明不能省**：
安装器只把声明了 `dsh.bundle` 的包当作 profile 层，其余的按普通依赖装入——
那样宿主半不会加载，而客户端半仍会因 `dsh.client` 被发现，症状是设置行照常显示、
点击也有反应，但首屏注入不生效、选择也存不下来。`verify-contract.mjs` 里有断言钉住这一点。

### 从本地目录安装（开发时）

插件安装界面也接受绝对路径，指向工作副本即可，装完改代码后重启 dsh web 生效。
注意**不要同时**保留本地路径安装和 `cordis.patch.yml` 里的手写条目，两者 id 相同会冲突。

## 用法

**设置 → 通用 → 主题预设**，点一个色块。

- 预设只决定**配色家族**，明暗仍由上一行的「外观」控制，两者正交。
  选了 Nord 之后，「浅色」= 它的 Snow Storm，「深色」= Polar Night，
  「跟随系统」则跟着系统在两者之间切。
- 每个色块显示当前明暗模式下该预设的底色 / 强调色 / 正文色，会随「外观」一起变。
- **默认** = DSH 自带配色，不做任何覆盖。
- 选择写进当前 Web profile 的 `cordis.patch.yml` 中 `theme-presets.config.preset`，跨刷新、跨重启保留。

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

## 宿主端加载

`Config` 由宿主入口同步导出，DSH Settings 从活动插件的 schema 生成表单。
插件读 `config.preset.get()`，因此修改选择后，下一次首屏注入也能读到新值。

1. **同路径的模块会被 ESM 缓存。**
   cordis 重载时按绝对路径 `import()` 插件，而 Node 对重复的 specifier 直接返回
   缓存模块——所以**改了被静态导入的源码，进程里跑的仍然是旧代码**。
   本插件只有 `presets.mjs` 走 mtime 动态载入；改 `host.js` 或 `src/plugin.mjs` 要重启。

2. **patch 条目按 `id` 做 diff，改 `name` 不生效。**
   只改注释不触发重载；改 `name` 也**不会**换用新路径，实测仍旧加载缓存里的旧模块。
   要让条目真正卸载重装，得先把整个 `- insert:` 块删掉保存，再加回来保存。

3. **`package.json` 的 `dsh.client.inject` 只在进程启动时解析。**
   HMR 只重建 bundle、不重读 package.json（`graphRow(id, rev, record.meta)`
   沿用旧 meta），所以改了那几项要重启才更新。
   它只影响加载顺序、不影响功能：真正的依赖由 bundle 里 `exports.inject`
   的服务名（`theme` / `slots` / `locale` / `configForms` / `remote`）保证，
   cordis 会等到服务出现才 apply。

## 配置 schema

宿主导出 `Config`，把 `preset` 声明为可实时修改的字段。DSH 从该 schema
生成设置表单，并将选择写入当前 profile 的 Cordis patch。
`@deepseek-ai/schemastery` 是 DSH 工作区私有包，因此 `src/schema.mjs`
实现所需的 Standard Schema 校验接口和 `{uid, refs}` 描述格式，无需安装时构建或新增依赖。

## 测试

```sh
node build-client.mjs   # 或 npm run build
npm test                # 五个套件，不需要运行中的 dsh
node e2e-test.mjs       # 可选：真实浏览器里的端到端验证，22 项
```

| 套件 | 覆盖 |
| --- | --- |
| `verify-contract.mjs` (15) | 复现 dsh 的客户端发现链路：包名、`dsh.client`、`./client` 导出形状、bundle id 与 package name 一致 |
| `schema-test.mjs` | Config 校验、未知 id 回退、volatile 描述格式 |
| `self-test.mjs` (19) | 浏览器端逻辑：接管时机（loading 期不接管）、92 token 覆盖、切换与持久化、未知 id 回退 |
| `host-test.mjs` | 宿主端：Config 校验、实时切换和首屏注入 |
| `bundle-test.mjs` (11) | 执行**真实产物** `lib/client.js`：注册形状、只 require `react`、导出面、内联数据完整 |
| `e2e-test.mjs` (22) | 真实浏览器（playwright + 本机 Chrome）：设置行出现、9 个选项、切换后浏览器端接管、持久化、重载后首屏层先绘制、两层取值一致、无 console 报错 |

前五个套件都在进程外跑，只有 `e2e-test.mjs` 会连真实 GUI —— 因此它**不在
`npm test` 里**：需要**运行中的 `dsh web`**（token 从
`<checkout>/.dsh-build/recovered-service.log` 读）、本机 Google Chrome，以及
dsh 检出里的 playwright。它在结束时会**恢复进入时的那个预设**，所以不会改掉你的选择。
dsh 检出不在默认位置时用 `DSH_CHECKOUT=/path/to/dsh` 覆盖。

## 目录

```
host.js             宿主入口：导出 Config，接线首屏注入
src/plugin.mjs      宿主端实现：注入行的构造
src/schema.mjs      自带的 Config schema（无外部依赖）
presets.mjs         唯一数据源：8 个预设的锚点色 + deriveTokens()
src/runtime.mjs     浏览器端源码（自包含函数，构建时内联进 bundle）
build-client.mjs    生成 lib/client.js
lib/client.js       构建产物，随仓库提交（浏览器实际加载的东西）
lib/client.d.ts     产物类型声明
e2e-test.mjs        可选：真实浏览器端到端验证
verify-contract.mjs / schema-test.mjs / self-test.mjs / host-test.mjs / bundle-test.mjs
                    进程外的测试套件
```
