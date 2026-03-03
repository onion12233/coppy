# 极简一键 AI 视频复刻工具（单页前端交互原型）

## 1️⃣ 页面整体架构

### 单页结构（Single Page）
- **页面容器**：`min-h-screen`，垂直三段结构（Top / Center / Bottom）。
- **最大宽度**：主体 `max-w-[960px] mx-auto px-6 md:px-10`。
- **状态切换方式**：同一路由（如 `/`）内通过前端状态机切换，不发生路由跳转。

### 顶部（固定简洁）
- 左侧：Logo（文字 Logo + 轻量图形）。
- 右侧：用户区（头像/登录入口，非核心可弱化）。
- 高度建议：`h-16`，底部分隔线 `border-b border-black/5`。

### 中央（核心交互区）
- 通过状态切换展示三套内容：
  - Idle（配置并发起）
  - Processing（处理中反馈）
  - Result（结果展示与下载）
- 居中布局，内容区建议 `max-w-[760px]`，提升聚焦感。

### 底部（轻量说明）
- 简短隐私/版权声明，如：
  - 「上传内容仅用于本次生成任务，不用于公开训练」
  - 「请确保拥有素材使用权」
- 文本弱化：`text-xs text-black/45`。

---

## 2️⃣ 状态设计

### 状态机
```txt
IDLE -> UPLOADING -> PROCESSING -> SUCCESS
  |         |            |            \
  |         |            -> ERROR <-----
  |         -> ERROR
  -> (恢复任务) PROCESSING / SUCCESS
```

### 状态定义
- **IDLE**：初始输入态，允许上传/粘贴链接与参数选择。
- **UPLOADING**：有本地文件时上传中，禁用主按钮并显示上传进度。
- **PROCESSING**：任务已创建，轮询任务状态并更新阶段文案。
- **SUCCESS**：任务完成，展示播放器与下载操作。
- **ERROR**：轻量错误提示，可重试。

### 状态切换规则
- IDLE → UPLOADING：选择本地视频并点击「一键复刻」。
- IDLE → PROCESSING：仅链接模式且参数校验通过，创建任务成功。
- UPLOADING → PROCESSING：上传成功并创建任务成功。
- PROCESSING → SUCCESS：轮询返回 `status=completed`。
- PROCESSING → ERROR：轮询返回 `status=failed` / 超时 / 网络连续失败。
- ERROR → PROCESSING：点击「重新生成」。
- 任意状态初始化恢复：若 `localStorage` 存在 `project_id`，进入恢复流程。

### 异常中断与恢复
- 页面关闭后重开：
  1. 读取本地 `project_id`。
  2. 请求 `GET /api/projects/:id`。
  3. 根据返回状态恢复到 PROCESSING / SUCCESS / ERROR。
- 轮询失败容错：采用指数退避（2s → 4s → 8s，最大 15s），超过阈值显示非阻塞提示。

---

## 3️⃣ UI 结构

### Idle（默认）

#### 布局分区
1. **标题区**
   - H1：`复刻任意视频`
   - 副标题：`上传参考视频或粘贴链接，几分钟生成完整复刻成片`
2. **输入区（卡片容器）**
   - 大号拖拽上传框（支持点击上传 + 拖拽态）
   - 「或粘贴视频链接」输入框
3. **参数区（不超过 3 行）**
   - 输出语言（Select）
   - 字幕模式（Segmented Control：自动 / 双语 / 关闭）
   - 风格强度（三档按钮：保真 / 平衡 / 创新）
4. **动作区**
   - 主按钮：`一键复刻`（高对比 + 大尺寸）

#### 组件结构
- `HeroTitle`
- `UploadDropzone`
- `VideoUrlInput`
- `LanguageSelect`
- `SubtitleModeSwitch`
- `StyleStrengthToggle`
- `PrimaryGenerateButton`
- `InlineValidationMessage`

#### 表单校验逻辑
- 至少满足其一：`file` 或 `video_url`。
- 链接合法性：`https://` 且域名在允许列表（可后端二次校验）。
- 文件限制：`mp4/mov/webm`，大小上限（如 500MB）。
- 参数完整性：语言、字幕模式、风格强度必须有默认值。
- 按钮禁用条件：
  - 无有效输入
  - 上传中
  - 正在创建任务

### Processing

#### 中央内容
- 大号加载动画（圆环或脉冲点阵，克制动效）。
- 阶段文案：`正在分析视频…`。
- 阶段时间轴（仅阶段名，不显示分段细节）：
  - 分析素材
  - 生成复刻
  - 智能拼接
  - 导出成片
- 可选进度条（平滑过渡，不显示技术日志）。
- 提示文案：`你可以关闭页面，任务会在云端继续。`

#### 失败态（ERROR）
- 轻量错误条：`本次生成失败，请重试。`
- 操作按钮：
  - 主：`重新生成`
  - 次：`返回修改参数`

#### 轮询更新 UI
- 轮询间隔：2~3 秒。
- 返回字段建议：`status`, `stage`, `progress`, `error_code`, `result_url`。
- 前端映射：
  - `stage=analyzing` → `正在分析视频…`
  - `stage=generating` → `正在生成复刻视频…`
  - `stage=stitching` → `正在拼接画面与音频…`
  - `stage=exporting` → `正在导出成片…`

### Result

#### 中央内容
- 大尺寸播放器（16:9，建议宽 720~800）。
- 主按钮：`下载视频`（视觉最强）。
- 次按钮：`再生成一次`（复用同参数）。
- 轻按钮：`更换语言后重新生成`（仅改 language）。

#### 再生成逻辑
- **再生成一次**：
  - 调用 `POST /api/projects/:id/regenerate`。
  - 携带历史参数快照。
  - 返回新 `project_id` 后切回 PROCESSING。
- **更换语言后重新生成**：
  - 仅开放 language 选择器。
  - 请求 `POST /api/projects/:id/regenerate-with-language`。

#### 复用已分析数据
- 后端基于 `source_asset_id` + `analysis_id` 复用分析结果。
- 前端仅传 `based_on_project_id` + 新参数（如 language）。
- UI提示：`已复用素材分析，预计更快完成。`

---

## 4️⃣ 组件树

```txt
AppPage
├─ PageShell
│  ├─ TopNav
│  │  ├─ Logo
│  │  └─ UserEntry
│  ├─ MainStage
│  │  └─ StateRenderer
│  │     ├─ IdlePanel
│  │     │  ├─ HeroTitle
│  │     │  ├─ UploadDropzone
│  │     │  ├─ VideoUrlInput
│  │     │  ├─ OptionsRow
│  │     │  │  ├─ LanguageSelect
│  │     │  │  ├─ SubtitleModeSwitch
│  │     │  │  └─ StyleStrengthToggle
│  │     │  └─ PrimaryGenerateButton
│  │     ├─ ProcessingPanel
│  │     │  ├─ Loader
│  │     │  ├─ StageText
│  │     │  ├─ StageStepper
│  │     │  ├─ ProgressBar
│  │     │  └─ ContinueHint
│  │     ├─ ResultPanel
│  │     │  ├─ VideoPlayer
│  │     │  ├─ DownloadButton
│  │     │  ├─ RegenerateButton
│  │     │  └─ RegenerateWithLanguage
│  │     └─ ErrorToast
│  └─ FooterNote
└─ GlobalTaskResumeBanner (可选)
```

### 状态管理建议
- 使用 `useReducer` 管理状态机，避免多个 `useState` 分散失控。
- 使用 `useEffect` 管理轮询生命周期（进入 PROCESSING 开启，离开即停止）。
- 可选 `TaskContext`：若后续接入登录态/多入口触发，统一共享任务状态。

Reducer 示例（概念）：
- `SET_INPUT`
- `SUBMIT_START`
- `UPLOAD_PROGRESS`
- `TASK_CREATED`
- `POLL_UPDATE`
- `TASK_SUCCESS`
- `TASK_ERROR`
- `RETRY`
- `RESTORE_FROM_PROJECT`

---

## 5️⃣ API 设计

### 1. 上传素材（可选）
- `POST /api/assets/upload`
- 入参：`multipart/form-data`（video file）
- 出参：`asset_id`, `asset_url`

### 2. 创建复刻任务
- `POST /api/projects`
- 入参：
```json
{
  "source_type": "file | url",
  "asset_id": "xxx",
  "video_url": "https://...",
  "output_language": "zh-CN",
  "subtitle_mode": "auto | bilingual | off",
  "style_strength": "low | medium | high"
}
```
- 出参：
```json
{
  "project_id": "proj_123",
  "status": "processing",
  "stage": "analyzing"
}
```

### 3. 查询任务状态（轮询）
- `GET /api/projects/:project_id`
- 出参：
```json
{
  "project_id": "proj_123",
  "status": "processing | completed | failed",
  "stage": "analyzing | generating | stitching | exporting",
  "progress": 65,
  "result": {
    "video_url": "https://.../result.mp4",
    "download_url": "https://.../download.mp4"
  },
  "error": {
    "code": "TIMEOUT",
    "message": "..."
  }
}
```

### 4. 再生成
- `POST /api/projects/:project_id/regenerate`
- 语义：沿用历史参数重新执行。

### 5. 改语言再生成
- `POST /api/projects/:project_id/regenerate-with-language`
- 入参：`output_language`
- 语义：复用分析数据，仅修改语言。

### 单页交互闭环
1. Idle 提交。
2. （可选）上传。
3. 创建任务拿到 `project_id` 并持久化。
4. 进入 Processing 轮询。
5. 完成进入 Result；失败进入 Error。
6. 支持基于当前结果再生成，回到 Processing。

---

## 6️⃣ 视觉系统建议

### 主色建议
- **基础色**：`#0A0A0A`（主文字） / `#FFFFFF`（背景）
- **强调色**：`#4F46E5`（单一品牌强调）
- **中性色阶**：`black/60`, `black/40`, `black/10`

### 按钮风格建议
- 主按钮（下载/一键复刻）：
  - `h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium`
  - 带轻微阴影 `shadow-[0_8px_24px_rgba(79,70,229,0.28)]`
- 次按钮：白底描边 `border border-black/15`
- 轻按钮：纯文字或弱底色 `bg-black/5`

### 间距规则（8pt 体系）
- 页面外边距：24 / 32
- 模块间距：24
- 组件间距：12 / 16
- 标题与副标题：12
- 按钮组间距：12

### 排版建议
- 字体：Inter + 系统中文回退（PingFang SC / Noto Sans SC）。
- 标题：`text-4xl md:text-5xl font-semibold tracking-tight`
- 副标题：`text-base text-black/60`
- 正文：`text-sm md:text-base`
- 全局控制：行宽适中（正文最大宽约 60~70 字符），避免信息密度过高。
