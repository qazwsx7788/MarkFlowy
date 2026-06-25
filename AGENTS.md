# AGENTS.md

MarkFlowy 是一个 Tauri (Rust) + React/TypeScript monorepo:一个桌面 Markdown 编辑器(真正的产品)、一个 Next.js 营销站点、共享的 `packages/*` 库、以及 Rust 的 `crates/*` 和 `tools/*` 工作区。产品背景见 `README.md`,面向用户的开发指南见 `docs/en/Community/CONTRIBUTING.md`。

> **重要**:本项目的发布构建由 GitHub Actions **自动完成**,开发者本地**不需要**运行 `yarn release` 或 `yarn build:desktop`。推送 `v*` 标签即可触发 `.github/workflows/tauri-release.yml` 在四平台上自动构建并发布。日常开发只需关注 `yarn dev:desktop` 等本地命令。

## 工具链(已固定版本)

- Node `24`(`.nvmrc`)、yarn `4.8.0`(`.yarnrc.yml` → `packageManager`)、使用 npm registry。
- Rust 工具链 `1.96`(`rust-toolchain.toml`);根目录的 Cargo workspace(`Cargo.toml`)。
- Ubuntu 桌面构建需要 `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libxcb-shape0-dev libxcb-xfixes0-dev libsoup-3.0 javascriptcoregtk-4.1 webkit2gtk-4.1`(见 `.github/workflows/nodejs.yml`)。

`yarn install --immutable` 是唯一正确的安装命令 —— CI 用的是 `--immutable`,而 `postinstall` 会运行 `patch-package`,这是 `patches/@tauri-release+cli+0.2.5.patch` 必需的。

**改依赖后必须用不带 `--immutable` 的 `yarn install` 重新生成 `yarn.lock`。** `--immutable` 模式下 lockfile 与 package.json 不一致会直接报错退出(`YN0028: The lockfile would have been modified`),CI 就是用这个模式。所以凡是改了任何 `package.json` 的 `dependencies`/`devDependencies`(新增、删除、改版本),改完必须本地跑一次普通 `yarn install`,把更新后的 `yarn.lock` **一起提交**,否则 CI 必挂在 install 步骤。

## 仓库目录结构

- `apps/desktop` —— `@markflowy/desktop`。Tauri 应用。前端是 Vite + React 19;后端是 `apps/desktop/src-tauri/`(Rust crate `markflowy`,`tauri = "2.10.3"`,release 构建用 `custom-protocol` feature)。配置:`tauri.conf.json`、`vite.config.ts`(端口 3000,严格模式;为 react/tauri/ai/antd/editor/preview 手动分 vendor chunk)。入口:`apps/desktop/src/main.tsx` → `App.tsx` → `router/`。
- `apps/web` —— `@markflowy/web`。Next.js 16 站点,端口 3100,使用 Turbopack 和 Contentlayer。**不是产品本身**,不要认为改动 `apps/web` 就会进入编辑器。
- `packages/` —— 共享的 TS 库,每个用 esbuild(部分用 Rollup 打类型)独立构建。重点:
  - `editor`(npm 名 `rme`)—— ProseMirror/CodeMirror 编辑器。较重:依赖 `@rme-sdk/*`(自定义)、CodeMirror 6、ProseMirror、mermaid(懒加载)、katex(公式)、antd v6。构建命令 `rimraf dist && esbuild build && rollup -c rollup.config.types.js`(后者只打类型)。
  - `i18n` —— esbuild,另会跑 `scripts/flatten-dts.mjs`。
  - `interface` —— "MarkFlowy 编辑器视图" 外壳(被 desktop 消费)。
  - `api-client`、`github-api`、`theme`、`types`、`runtime-api`、`zens`(UI 组件库)。
  - `zens` 是独立的 dumi 组件库,有自己的一套 `gulpfile.js`、`jest.config.js`、`.dumirc.ts` —— **不要**在根脚本里跑它。
- `crates/` —— 被 desktop 通过 path 依赖消费的 Rust crate:`utils`(`mf-utils`)、`file_search`(`mf_file_search`)、`download_npm`(`download_npm`)。都是库,不是 binary。
- `tools/cli` —— `mfdev` 二进制。`yarn release`(`scripts/release.js` 调用 `cargo run -p mfdev -- release ...`)使用它。会同时修改 `apps/desktop/src-tauri/tauri.conf.json` 和 `apps/desktop/src-tauri/Cargo.toml` 中的 `version`,然后 commit 并 push。
- `locales/*.json` —— 基础 `zh-CN.json`,其他语言为翻译。`scripts/translate-check.js`(由 `yarn translate:check` 或 `.github/workflows/translate-check.yml` 触发)以 **`en.json`** 为基准强制 key 一致性 —— **不是** `zh-CN.json`,尽管该文件的 `console.log` 是中文。新增字符串:先加到 `locales/en.json`,再翻译。
- `docs/` —— 类 Docusaurus 站点(中英双语);web 应用有独立的文档。
- `patches/` —— patch-package 补丁,在 `postinstall` 时应用。
- `community-themes.json` —— 应用内主题商店的主题列表。

## 命令(根目录)

所有根脚本都在 `package.json` 里。能用 workspace 的地方都用 Turbo:

- `yarn install --immutable` —— 安装依赖;必需。
- `yarn setup` —— 跨 workspace 跑 `turbo postinstall`。
- `yarn build` —— `turbo build --concurrency=2`(构建所有 workspace)。**首次 `dev:desktop` 之前必须先跑** —— desktop 应用会从 `@markflowy/i18n` 的预构建 `dist/index.js` 导入(见 `apps/desktop/vite.config.ts` 中的 vite alias)。
- `yarn build:web` —— 构建除 `@markflowy/desktop` 外的所有内容。
- `yarn build:desktop` —— 构建除 `@markflowy/web` 外的所有内容,然后 `tauri:build`。可加 `--target <triple>` 选择 Tauri 目标平台。**本地通常不需要跑**,正式构建由 GitHub Actions 完成(见下文)。
- `yarn dev` —— `turbo dev`(各 workspace 的 dev)。多数 workspace 没定义 `dev`。
- `yarn dev:desktop` —— 启动桌面 dev 的首选方式。内部会先杀掉 3000/3030/1420/8000 端口,跑 `turbo run dev`(排除 web 和 desktop 包),等 8 秒,再跑 `yarn workspace @markflowy/desktop tauri:dev`。**不要**直接跑 `vite` 启动 desktop —— `scripts/dev-desktop.mjs` 会编排多个进程并在 SIGINT 时清理。
- `yarn test` —— `turbo test`(各 workspace 的 vitest)。
- `yarn lint` —— 根目录只跑 `eslint --fix --ext .tsx ./`(**只**针对 `*.tsx`,不包括 `.ts`/`.js`)。这是有意的,不完全;非 `.tsx` 文件需要 lint 修复时,跑对应 workspace 自己的 eslint。
- `yarn translate:locals` —— 调用阿里云 MT(需要环境变量 `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET`)。`yarn translate:check` 是不联网的校验。
- `yarn use-offline-bundle` —— 修改 `tauri.conf.json`,使用 WebView2 离线安装器(仅 Windows)。
- `yarn release` / `release:patch` / `release:minor` / `release:major` —— `cargo run -p mfdev -- release ...`。写版本号到两个文件,然后 `git add . && git commit && git push` 并向 `markflowy` 远程打 tag。**会**提示输入 `y/n` —— 非交互式 CI 跑会卡住。**注意**:发布流也向名为 `markflowy` 的远程 push,跑之前确保该远程已在本地配置好。**正常情况下不需要本地跑这个,见下一节。**
- `yarn updater` —— 运行 `@tauri-release/cli` 更新器(打过补丁,见 `patches/@tauri-release+cli+0.2.5.patch`)。

### 发布流程:完全由 GitHub Actions 自动完成

**不要在本地跑 `yarn release` / `yarn build:desktop`。** 本项目的发布流程是:

1. 在 `.github/workflows/` 下配置:
   - **`tauri-release.yml`** —— 由推送 `v*` 标签触发(例如 `v0.81.5`)。包含 4 个 job:
     - `build`:在 Linux x64 / macOS x64 / macOS aarch64 / Windows x64 四平台并行构建,产出 `AppImage` / `deb` / `rpm` / `dmg` / `app.tar.gz` / `msi` / `nsis` 安装包,作为 artifacts 上传。
     - `build-offline-installer`:仅 Windows x64,多跑一步 `yarn use-offline-bundle`,产出内置 WebView2 运行时的离线安装器。
     - `release`:依赖上两个 job。把 artifacts 重命名为 `MarkFlowy_v<version>_<arch>.<ext>`,生成中英 FAQ release notes,用 `softprops/action-gh-release@v2.1.0` 创建 GitHub Release(**注意 `prerelease: true`** —— 用 `v*` 标签触发的发布是预发布状态)。然后跑 `yarn updater` 生成 `apps/desktop/updater/install.json`,再覆盖上传到同一 Release,并用 `peaceiris/actions-gh-pages@v3` 部署到 gh-pages。
     - `upgradeLink-upload`:依赖 `release`。通过 `toolsetlink/upgradelink-action@3.0.2` 把 release 信息同步到 UpgradeLink 国内加速下载服务(即 README 里的 `download.upgrade.toolsetlink.com`)。
   - **`test-bundle.yml`** —— 由 `ci/fix_webview_bundle` 分支 push 触发,用于试跑 bundle 构建(可写 `.env`,有离线安装器 job)。
   - **`nodejs.yml`** —— PR 触发的常规 CI 编译检查(各平台都跑 `yarn build` + `yarn build:desktop`)。
   - **`test-ci.yml`** —— 跑 `yarn test`。
   - **`translate-check.yml`** —— 跑 `yarn translate:check`。
2. 日常发版的标准流程:在 PR 合入 `main` 后,本地只改 `apps/desktop/src-tauri/tauri.conf.json` 和 `apps/desktop/src-tauri/Cargo.toml` 中的 `version` 字段(或用 `mfdev` 在本地生成这两个改动),commit 并 push 一个 `v<新版本号>` 标签即可,GitHub Actions 会接管剩下的工作。
3. 完整 CI 需要的 secrets:`TAURI_PRIVATE_KEY` / `TAURI_KEY_PASSWORD`(签名)、`ACCESS_TOKEN`(checkout + 推 gh-pages)、`GITHUB_TOKEN`(创建 Release、gh-pages 部署)、`VITE_SENTRY_DSN`(注入 `apps/desktop/.env`)、`UPGRADE_LINK_ACCESS_KEY` / `UPGRADE_LINK_ACCESS_SECRET` / `UPGRADE_LINK_TAURI_KEY`(UpgradeLink 同步)。

### 值得记住的 per-workspace 脚本

- `apps/desktop`:`vite build`、`vite dev`(端口 3000)、`tauri:dev`、`tauri:build --features custom-protocol`(release)、`vitest run` / `vitest --ui`。`tsc --tsconfig ./tsconfig.types.json` 生成类型。
- `packages/editor`:`yarn build` = `clear && esbuild prod && types`;`yarn dev` 跑 esbuild dev 配置并在 3030 端口 serve playground。
- `packages/i18n`、`packages/api-client` 等:通过 `yarn dev` 跑 esbuild `--watch`。

## Lint / typecheck / test(实际可用的)

- 根目录 `yarn lint` 只 lint `.tsx`,用 ESLint flat config(`.eslintrc` 继承 `@halodong/eslint-config-react`,Babel parser,旧式 decorators)。`.ts` 文件用对应 workspace 的 eslint。
- **没有**根目录的 `typecheck` 脚本;`turbo.json` 定义了一个但没在根 `package.json` 暴露。各 workspace 跑 `tsc -b`,或者靠 IDE/TS build。
- 测试:Vitest,在 `apps/desktop` 和 `packages/editor` 里。desktop 用 happy-dom,editor 用 jsdom。editor 测试把 `zens` 别名到本地 mock(`packages/editor/src/editor/test/__mocks__/zens.ts`)。
- `yarn test` 会先跑 `^build`(Turbo) —— 也就是说会先构建,跑测试前构建是预期的。

## 风格 / 与默认不同的约定

- Prettier:无分号、单引号、100 列、`jsxSingleQuote: true`、trailing comma `all`(`.prettierrc.js`)。
- Rust:`.rustfmt.toml` 强制 `max_width = 100`、Unix 换行、edition 2021、`force_explicit_abi = true`。
- TypeScript:`tsconfig.base.json` 是 `composite: true`、`emitDeclarationOnly`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`、`strict`。
- Editor 在 npm 上的名字是 `rme`(见 `packages/editor/package.json` 的 `name`)—— 在 desktop 应用里通过 `workspace:*` 解析。
- `apps/desktop/src-tauri/tauri.conf.json` 引用的 schema 路径是 `../node_modules/...`;Vite/Tauri 期望从 `apps/desktop` 目录运行,或通过根脚本运行。

## 易踩的坑

- `@tauri-release/cli` 在 `patches/` 里有补丁。不带 `--immutable` 跑 `yarn install` 可能丢掉补丁。`postinstall` 会重新打上。
- `apps/desktop/src-tauri/src/lib.rs` 中的 `opened_urls_to_string`:**不要**对反斜杠再转义 —— 那个文件里的注释记录了 Windows/WSL 路径损坏的 bug,如果你"修"了转义就会踩到。
- `locales/en.json` 是规范的 key 集合,不是 `zh-CN.json`(翻译源语言是 `zh-CN`,但 `translate-check.js` 用 `en.json`)。
- `mfdev` release 工具会 `git add .` 然后 push;跑 `yarn release` 之前先 review 暂存的文件。
- macOS aarch64 构建在 `README.md` 里要求 `xattr -cr MarkFlowy.app` 来绕过 Apple 对未签名应用的限制。
- 根目录 `tsconfig.json` 只引用 `apps/desktop/tsconfig.json` —— 基础配置并没有被直接 project-referenced。各 workspace 用自己的 `tsc` 来 typecheck。
- `patches/` 目录和 `.yarn/releases/` 是 vendored(`.gitattributes`),但其他 `.yarn/*` 在 .gitignore 里。
- **不要 `git add .` / "全部提交"**:工作区里常有一批**被 git 跟踪的生成产物**(注意:不在 .gitignore 里),它们被本地工具重新生成后会显示为"已修改/已删除"。典型:`apps/web/.contentlayer/generated/**`(Contentlayer 产物,web 构建直接 import 它,删了 web 构建报 `Cannot find module 'contentlayer/generated'`)、各 workspace 的 `tsconfig.tsbuildinfo`(TS 增量缓存)、`packages/zens/.dumi/**`。提交前必须 `git status` 甄别,**只提交你本次意图改动的文件**;若发现这类无关删除,用 `git checkout <旧commit> -- <路径>` 从上一个正常 commit 恢复。
- **改 `packages/editor` 后,提交前先跑 `yarn workspace rme build` 验证**(包名是 `rme`,不是 `@markflowy/editor`)。该 build 会跑 esbuild 打包 + rollup 生成类型,能在本地捕获类型/编译错误,不必等 CI。注意 editor 依赖的 `@markflowy/i18n`/`zens` 等需先有 `dist`(见 `yarn build`),否则类型检查会报一堆 "Cannot find module '@markflowy/...'" —— 那些是依赖未构建,不是真错误。
- **fork 上 `tauri-release.yml` 和 `contribute_list.yml` 会失败**。Release 的第一步 `actions/checkout` 需要 `secrets.ACCESS_TOKEN`(不是默认的 `GITHUB_TOKEN`),缺了秒报 `Input required and not supplied: token`;`contribute_list.yml` 要写 README,缺权限报 `Resource not accessible by integration`。这些在缺 secrets/写权限的 fork 上**本来就会失败**(与代码无关)。要真正发版需配齐第 3 节列的全部 secrets,或只关注 `build-windows.yml`/`test-ci.yml` 的构建结果。
- **打 `v*` 标签前必须升版本号**:`apps/desktop/src-tauri/tauri.conf.json` 和 `apps/desktop/src-tauri/Cargo.toml` 两处的 `version` 必须比上一个 release 大,否则标签会重复或被覆盖。同号标签 force-push 会重新触发但属非常规操作。
