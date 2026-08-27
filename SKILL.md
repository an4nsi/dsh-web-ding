---
name: dsh-plugin-dev
description: 给 DeepSeek Harness (dsh) 编写并 dev-mount 一个插件。覆盖 cordis 双半（host/client）、client 插件脚手架（package.json 的 dsh.client + tsdown CJS 闭包工厂）、把任务完成等 harness 事件接成浏览器行为、以及用 dsh-flake 的 devMounts 把本地 checkout 热挂载进 web profile（含纯 dsh.client 插件用 cordis.patch.yml 的 insert、bundle 插件用 bundles 的区别与 loadProfile 对 dsh.bundle 的强制）。触发：加 dsh 插件、dsh plugin、dev mount、client plugin、浏览器通知、task 完成通知、Web Notification、dsh-flake 加扩展。
---

# 给 dsh 加插件（开发 + dev-mount）

dsh = DeepSeek Harness，cordis 插件系统。参考成品：`dsh-web-ding`（一个后台任务完成时弹浏览器通知的纯 client 插件）以及它如何被 dev-mount 进 `dsh-flake`。

## 何时用
- 要扩展 dsh 的 web UI 行为（通知、侧边栏、槽位注入），或把某个 harness 事件（如任务完成 `ctx.jobs.onJobDone`）接成前端效果。
- 要在 `dsh-flake`（Nix）里把本地插件源码热挂载进某个 profile 调试。

## 架构速记
- 插件有**两半**：host 半（`apply(ctx: Context)`，跑在 Node）和 client 半（`apply(ctx: ClientContext)`，跑在浏览器）。纯前端插件 host 半可为空 `export function apply(): void {}`。
- client 插件靠 `package.json` 的 `dsh.client` 声明 + `exports["./client"]` 被 `client-modules` 发现；build 产物是 CJS 闭包工厂，自带 `window.__ModuleLoader__.load({ id: <包名>, factory })`。**bundle id 必须等于 npm 包名**（boot graph 按包名 key）。预设在 `packages/client/tsdown.client.ts`，DSH-better-sidebar / ui-jobs 都照它。
- client 插件发现机制：只扫 `ctx.loader.entries()`（cordis 已挂载的 entry），逐个 `require.resolve('<name>/package.json')` 读 `dsh.client`（`packages/client/modules/src/index.ts`）。所以插件必须是一个被挂载的 cordis entry，否则 client 半不会被加载。

## 脚手架一个 client 插件（照 ui-jobs 最简）
目录：`src/index.ts`(host) + `src/client/index.ts`(client) + `src/client/X.tsx`(组件) + `package.json` + `tsdown.config.ts` + `tsconfig.json`。

`package.json` 要点：
```json
{
  "name": "<npm-name>",
  "dsh": { "client": { "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-slots"], "platform": "web" } },
  "exports": { ".": {"default":"./lib/index.js"}, "./client": {"default":"./lib/client.js"}, "./package.json":"./package.json" },
  "peerDependencies": { "@deepseek-ai/cordis":"^4.0.1", "@deepseek-ai/dsh-client-runtime":"^0.1.0-rc.8", "@deepseek-ai/dsh-client-ui-slots":"^0.1.0-rc.8", "react":"^18.2.0" }
}
```
- host 半 `src/index.ts`：`export const name = '<npm-name>'; export function apply(): void {}`。
- client 半 `src/client/index.ts`：
  ```ts
  import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
  export const name = '<npm-name>'
  export const inject = ['slots']
  export function apply(ctx: ClientContext): void {
    const slots = ctx.slots as unknown as { inject(n:string,f:()=>unknown):void; register(o:{name:string;id:string;order?:number},c:unknown):unknown }
    slots.inject('conversation.session.header.actions', () =>
      slots.register({ name:'conversation.session.header.actions', id:'<your-id>', order:95 }, YourComponent))
  }
  ```
  （用 `PropsRuntime<'conversation.session.header.actions'>` 也行，但已发布的 rc.8 的 slots 类型偏窄；给 `slots` 打最小接口更稳，运行时服务一致。）
- 组件 `src/client/X.tsx`：从槽 standard props 拿 `sessionId`、`useSession`（读 ConversationSnapshot）、`useSessions`（读会话列表）。先问清「任务完成」指哪种：① 后台 job 结束 → `useSessions((s) => s.jobsBySession[sessionId])` 得 `JobView[]` 检测 terminal 转变；② 主 agent 停止输出（多数人指这个）→ `useSession((s) => s.running)` 检测 true→false。
- `tsdown.config.ts`：`defineConfig([ host(esm/node→lib/index.js), client(cjs/browser→lib/client.js) ])`。client 配置：
  - `deps.neverBundle` = `['react','react/jsx-runtime','cordis','@deepseek-ai/dsh-client-runtime/client','@deepseek-ai/dsh-client-ui-slots']`（框架模块必须 external，purity gate 禁止 cross-plugin 值导入；其余内联）。旧版字段名是 `external` / `noExternal`。
  - `outputOptions`: `entryFileNames:'client.js'`, `banner: window.__ModuleLoader__.load({ id: "<npm-name>", factory: (require) => {`, `footer: return module.exports; } });`, `intro: var module={exports:{}}; var exports=module.exports;`。
  - `define` `process.env.NODE_ENV` / `import.meta.env` 为 `'production'`。
- `tsconfig.json`：`jsx: react-jsx`, `allowImportingTsExtensions: true`, `lib` 含 `DOM`。

**「完成」信号速查**：① 后台 job = host `ctx.jobs.onJobDone(...)`（`packages/jobs/jobs/src/types.ts`）或浏览器镜像 `jobsBySession`（`manager.ts:53`，ui-jobs 模式）；② 主回合结束 = 客户端 `ConversationSnapshot.running` 布尔（`packages/client/runtime/src/client/sessions/conversation.ts`），槽 prop `useSession((s) => s.running)` 读取，true→false 即 agent 停止输出——用户说「task 完成」通常指这个而不是后台 job。两者都是 client 镜像，reverse-proxy 场景同样有效。

## dev-mount 进 dsh-flake
`dsh-flake/flake.nix` 用 `dshNur.lib.mkDsh`，插件来自 `dshNur.packages`。dev 热挂载用 `devMounts`：
```nix
devMounts = { "<npm-name>" = { src = "/abs/path/to/plugin/source"; }; };
```
机制（`dsh-nur/lib/module.nix` 的 `devOverlay`）：把 `node_modules/<npm-name>` 这一个入口换成指向 src 的 symlink；src 必须含 `package.json` + `lib/`（即先 `tsdown` 构建好）。impure 绝对路径，不进 store，改源码热重载（改 `src/` 后重跑 `npm run build` 重新生成 `lib/`）。

挂载成 cordis entry（否则 client 半不被发现）——二选一：
- **纯 `dsh.client` 插件（无 `dsh.bundle`）** → 在 `config/web/cordis.patch.yml` 加 `insert` 行（照 `dsh-web-search-exa`）：
  ```yaml
  - insert:
      - id: <your-id>
        name: '<npm-name>'
  ```
  不要放进 `bundles`：`loadProfile` 对 `bundles` 里每一项强制要求 `dsh.bundle`，没有就抛 *"profile bundle '<npm-name>' declares no dsh.bundle"*（`packages/boot/app-boot/src/profile.ts`）。
- **bundle 插件（有 `dsh.bundle`）** → 给插件 `package.json` 加 `"bundle":{"patch":"./cordis.patch.yml"}` + 建 `cordis.patch.yml` 挂它自己的 host `apply`，然后在 flake.nix 的 `bundles.web` 加 `"<npm-name>"`，删掉上面的 `insert`。即 dsh-better-sidebar / dsh-fork-view 写法。

只挂 `web` profile（浏览器插件）；`headless` 不需要。

## 验证
- 插件：`npm_config_cache=/writable npx tsc --noEmit` + `npx tsdown`（本机构建过 `dsh-web-ding` 即此流程）。
- flake：`XDG_CACHE_HOME=/writable nix flake check --no-build`（缓存 root 属主只读时会报 SQLite readonly，重定向即可）。
- patch YAML：`nix-shell -p python3Packages.pyyaml -c "python3 -c \"import yaml; yaml.safe_load(open('config/web/cordis.patch.yml'))\""`。

## 坑
- 本环境 nix 默认缓存 `~/.cache/nix` 当前是 agent 属主可写，通常无需重定向；仅在它不可写（旧容器曾 root 属主只读）时才设 `XDG_CACHE_HOME`/`npm_config_cache` 到工作区可写路径。工作区里 `cache-nix-<pid>`/`cache-nix-dshnur`/`.cache-nix-dshjob` 这类目录是 harness 每次调 nix 按进程/job 建的独立缓存，内容雷同，冗余的 PID 版可安全删。
- client bundle 只 externalize react/runtime/slots；其余 `@deepseek-ai/*` 当作值导入会触发 purity gate 构建错误（用 type-only 导入）。
- 浏览器通知需用户手势触发 `Notification.requestPermission()`（挂在按钮点击上）。**别拿 `document.hidden` 当弹出的前置条件**：用户盯着页面测试时永远不弹，会被当成「没效果」来报障。
- 用 `running` 转变做触发时要按 sessionId 重置 transition 基线（ref 记 prev sessionId + prev running），否则切会话的瞬间可能拿旧会话状态误触发一次。
- 「通知不显示」排查顺序：权限 granted 且 `show` 事件已触发仍不见 → 是 **OS 通知中心**层（macOS 系统设置→通知→Chrome 被禁是高频坑；Windows 专注助手；Linux 缺通知守护进程）。通知由 OS 原生系统渲染，浏览器内一切正常也可能不显示。DevTools 里直接 `new Notification('test')` 可一步隔离是插件还是环境。诊断日志用 `console.info`（`console.debug` 属 Verbose，Chrome 默认不显示，会被误报「没日志」）。
- 不依赖通知中心的兜底：页面用 Web Audio 手动播音效（用户手势解锁 AudioContext 后即可响），pi-web 的「叮」就是这么做的——看起来像通知生效了，其实只是音效。
- 独立设置分区（settings.section）契约：`label` 必须是 thunk（`() => string`）；`order: 100` = 排最后（原生最大 20）；**icon 不在契约里**——导航按 id 硬编码齿轮，外部分区永远是齿轮；组件只收到 `{close}`，翻译/商店要靠自己的 inject face 或模块级 t。开关控件框架没有——照 better-sidebar 的 Switch 配方（隐藏原生 checkbox + track/thumb）。样式直接用宿主全局 `--dsw-alias-*` token（卡片 = l2 描边 + r16 + layer-3 底），CSS modules 要把官方预设的 lightningcss 内联插件移植进自己的 tsdown（见 dsh-web-ding/tsdown.config.ts 的 dshCssModules）。参考实现：dsh-web-ding。
- 「接入官方设置 API」的真相：设置页所有扩展点都是 cordis slot，必须交 React 组件，没有 schema 自动渲染；最小座位是 `settings.general.item`（一行，label/控件/写路径全归你），其 onChange 就是合法用户手势——`Notification.requestPermission()` 挂那里。持久化别用 `ctx.settingsScope`：反代（非 loopback）连接下它退化为 memory（settings-scope.ts `isLoopback ? 'host' : 'memory'`），刷新即丢——用 localStorage 自存。常驻监听引擎可以渲染为 null 挂在会话槽里。
- 移植第三方代码进插件时，文件 header 必须带来源+协议声明（例：`src/client/chime.ts` 头部注明移植自 agegr/pi-web 的 hooks/useAudio.ts、MIT、参数未改）。官方 `dsh-client-ui-primitives` 共 70 个图标但没有铃铛类；缺图标时两个选项：按它规范自绘，或经用户拍板用 lucide-react（ISC）——但**必须走按图标深路径** `lucide-react/dist/esm/icons/<name>.mjs`（补 ambient d.ts），因为它的 main 指向不可 tree-shake 的 CJS 主包，普通 import 会把 ~1500 个图标全打进去（实测 26KB→718KB，深路径回落到 ~40KB）。别用 emoji 当图标。
