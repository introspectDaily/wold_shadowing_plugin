# 单词跟读（Word Shadowing）

一个浏览器插件（Chrome Manifest V3）：查单词 → 听标准发音 → 跟读录音 → 回放对比 → 标记常用跟读 → 按间隔重复记忆。

相当于“网页版有道词典 + 跟读练习 + 单词记忆本”。

## 功能

- **标准发音**：展示音标，支持美式 / 英式两种发音（有道词典语音，失败自动用浏览器语音兜底）
- **释义**：优先走有道自己的词典接口（jsonapi，只取简明释义 ec，响应 ~1KB），和标准发音/有道网页同源、速度快；失败时兜底用 dictionaryapi.dev；带 7 天本地缓存
- **有道页面直接跟读**：打开 `dict.youdao.com` / `youdao.com` / `www.youdao.com` 的任意单词页（如 `https://youdao.com/result?word=hello`），页面右下角自动出现跟读面板，直接在词条旁边录音、回放、标记。面板上的**英美音标与释义直接复用有道页面已有的数据**，不做重复查询
- **跟读录音**：点“开始跟读”录音，自动保存，随时回放
- **默认展示最新 3 条跟读**；可“查看全部”
- **标记跟读**：点图钉标记某条跟读，它会一直显示、不会被折叠
- **单词管理**：搜索添加单词、按状态筛选、删除单词（连同其录音）
- **记忆功能**：忘记 / 模糊 / 记得 / 简单 四档复习，自动计算下次复习时间（间隔重复），到期标为“待复习”
- **划词查询**：选中网页里的英文单词 → 右键 → 「在单词跟读中查询」，自动打开侧边栏
- **设置**：弹窗 / 侧边栏 / 有道页面面板右上角都有设置入口，可开关「消除跟读录音开头的“du”杂音」。默认开启：录音在源头就不录入开头的瞬态杂音，旧录音播放时也会自动跳过；关闭则完全按麦克风原始声音录制

## 界面

- **弹窗（popup）**：点工具栏图标，快速查询 / 添加单词
- **侧边栏（sidepanel）**：完整单词本与跟读管理；弹窗里点“侧边栏”按钮可打开
- **独立页面（options）**：左侧导航的全屏页面，包含「单词本 / 记忆复习 / 设置」。弹窗或侧边栏右上角的「展开」图标可打开，也可在 `chrome://extensions` → 单词跟读 → 详细信息 → 扩展程序选项 打开
- **有道页面面板（content script）**：在 `dict.youdao.com` 单词页右下角，跟着词条直接跟读；面板上的书本按钮可一键打开完整侧边栏

## 安装（Chrome / Edge 等 Chromium 浏览器）

**推荐：从 [Releases](https://github.com/introspectDaily/wold_shadowing_plugin/releases/latest) 下载**
`word-shadowing-<版本>-chrome.zip`，解压后按下面步骤加载；或直接加载本地构建的 `dist/chrome-mv3/` 目录：

1. 打开 `chrome://extensions`
2. 打开右上角「开发者模式」
3. 点「加载已解压的扩展程序」
4. 选择解压后的目录（或本项目的 `dist/chrome-mv3` 目录）

> 首次使用录音功能时，浏览器会请求麦克风权限，请允许。

## 使用流程

1. 点工具栏图标，输入英文单词回车 → 加入单词本并进入详情页
2. 也可以直接打开 `dict.youdao.com` 查词，页面右下角的跟读面板里就能录音
3. 听美 / 英发音，跟着读，点「开始跟读」录音 →「保存」
4. 在录音列表里回放对比；点图钉标记最满意的跟读（一直保留）
5. 读完后点「记得 / 模糊 / 忘记 / 简单」记录记忆程度
6. 之后打开侧边栏，在「待复习」里按计划复习

## 数据存储

- 单词与记忆进度：`chrome.storage.local`
- 跟读录音（音频文件）：扩展自己的 IndexedDB（`word-shadowing-db`）
- 全部本地存储，不上传任何录音；删除单词会同时删除它的录音

## 开发

```bash
pnpm install
pnpm dev            # 开发模式（自动打开浏览器）
pnpm build          # 构建 Chrome 到 dist/chrome-mv3
pnpm build:firefox  # 构建 Firefox 到 dist/firefox-mv2
pnpm zip:all        # 打包 Chrome + Firefox zip
pnpm compile        # 类型检查
pnpm test           # 单元测试
pnpm verify         # 类型检查 + 单元测试
```

## 版本管理与发布

版本号唯一来源是 `package.json` 的 `version`，`wxt.config.ts` 会把它注入到
`manifest.version` / `manifest.version_name`，因此**不需要**再手动改任何 manifest 里的版本。

整个发布链路全部在 GitHub Actions 上完成：

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| `ci.yml` | push 到 `main` / PR / 手动 | 类型检查 + 单元测试 + Chrome/Firefox 构建，产物上传为 artifact |
| `version-bump.yml` | 手动（Actions → Bump Version → Run workflow） | 选择 patch/minor/major/pre*，自动 `npm version` → 提交 → 打 `v*` tag → 推送 → 调用 `release.yml` |
| `release.yml` | push `v*.*.*` tag / 手动指定 tag / 被 `version-bump.yml` 复用 | 校验版本一致性 → 构建 → 打包 zip → 生成 SHA256SUMS → 创建 GitHub Release 并附上产物 |

### 发一个正式版

在 GitHub 仓库页面：**Actions → Bump Version → Run workflow**，选择 `patch` / `minor` / `major` 即可。
流水线会自动完成「改版本号 → 打 tag → 构建 → 发布 Release」。

### 发一个预发布版

同样入口，`bump` 选 `prerelease` / `prepatch` / `preminor` / `premajor`，`preid` 填 `beta` 之类。
tag 里带 `-` 的会被自动标记为 GitHub 的 prerelease。

### 手动打 tag 发布

```bash
npm version minor        # 会改 package.json 并打 vX.Y.Z tag
# 或者直接： git tag v0.2.0
git push --follow-tags
```

推送 tag 后 `release.yml` 自动运行，产物：

- `word-shadowing-<版本>-chrome.zip` —— Chrome / Edge 安装包（解压后「加载已解压的扩展程序」）
- `word-shadowing-<版本>-firefox.zip` —— Firefox 安装包
- `word-shadowing-<版本>-sources.zip` —— AMO 要求的上架源码包
- `SHA256SUMS.txt` —— 校验和

> 注：用 `GITHUB_TOKEN` 推送的 tag 不会再触发 `push` 事件（GitHub 的防递归机制），
> 所以 `version-bump.yml` 是通过复用 `release.yml`（`workflow_call`）来发版的，无需额外 PAT。

### 可选：自动上架商店

`release.yml` 末尾预留了 Chrome Web Store 的注释步骤，配置对应 Secrets 后取消注释即可。

项目结构：

```
src/
  entrypoints/
    background.ts      # 右键菜单、划词查询
    content.ts         # 有道单词页的跟读面板（shadow DOM + iframe）
    inject/            # 面板内嵌页（紧凑跟读组件）
    options/           # 独立页面（左侧导航：单词本 / 记忆复习 / 设置）
    popup/             # 弹窗
    sidepanel/         # 侧边栏（完整面板）
  components/          # WordDetail / RecordingList / RecorderWidget 等
  hooks/               # useRecorder / useRecordings / useWords 等
  lib/
    db.ts              # IndexedDB（录音 blob）
    words.ts           # 单词本 + 间隔重复逻辑
    dict.ts            # 词典 / 标准发音服务
```
