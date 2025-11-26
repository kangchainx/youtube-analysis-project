# YouTube Analysis 前端

现代化的 YouTube 频道分析与转写面板。支持频道数据洞察、视频转文字任务、实时通知、深色/浅色主题与可观测性工具集成。配套后端仓库：<https://github.com/kangchainx/youtube-analysis-backend>

> 如果这个项目对你有帮助，请点亮一个 Star 🌟，你的支持是我持续维护的动力。

## 主要特性

- **频道搜索与洞察**：按频道名称或 @handle 搜索，展示订阅数、观看数、视频数等关键指标，支持表格/卡片双视图与分页。
- **转写任务中心**：调用 `/api/video-translate/*` 创建与跟踪视频转写任务，SSE 实时进度流，完成后可获取下载链接（Markdown/TXT 优先）。
- **通知流**：SSE 推送任务/系统通知，未读数实时更新，可批量/单条标记已读。
- **服务健康面板**：仪表盘内展示转写服务状态，支持一键刷新，暗黑模式适配。
- **响应式与可访问性**：基于 Radix UI + Tailwind，提供骨架屏、空状态、无障碍交互；完整深浅色主题。
- **一键部署**：提供 Dockerfile 与 docker-compose，支持前后端联动部署与本地反向代理。

## 快速开始

### 环境准备

- Node.js 18+（推荐 LTS）
- 配套后端：<https://github.com/kangchainx/youtube-analysis-backend>（默认 API 基址 `http://localhost:5001`）
- 可选：在项目根目录创建 `.env.local`/`.env`，示例：

```bash
VITE_API_BASE_URL=http://localhost:5001    # 如需自定义后端地址
# 仅当后端未提供 /api/config/youtube-api-key 时，才使用本地 Key 兜底
VITE_YOUTUBE_API_KEY=你的_YT_API_Key
```

### 本地开发

```bash
npm install
npm run dev
# 浏览器访问 http://localhost:5173
```

常用脚本：
- `npm run lint`：代码质量检查
- `npm run build`：构建产物
- `npm run preview`：本地预览生产构建

### Docker

仅前端（需自备后端或 API 代理）：

```bash
docker build -t youtube-analysis-frontend:latest .
docker run -d -p 8080:80 --name youtube-frontend youtube-analysis-frontend:latest
```

前后端一键（建议）：在后端仓库构建后端镜像后，使用当前仓库的 `docker-compose.yml`：

```bash
BACKEND_IMAGE=youtube-analysis-backend:latest docker-compose up --build
# 后台运行：加 -d
```

## 功能截图

![](./public/screenshot/login_page.png)
![](./public/screenshot/home_page.png)
![](./public/screenshot/search_result_table_page.png)
![](./public/screenshot/search_result_card_page.png)
![](./public/screenshot/search_result_detail_page.png)
![](./public/screenshot/profile_page.png)

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS 4、Radix UI、shadcn/ui 组件
- SSE 事件源（转写任务进度、通知流）
- Sonner Toast、Lucide 图标

## 路由与模块

- `/home`：频道搜索与列表
- `/detail/:videoId`：视频详情与转写发起
- `/workbench/dashboard`：指标概览 + 服务健康
- `/workbench/tasks`：转写任务中心（SSE 实时更新、文件下载）
- `/workbench/notifications`：通知中心（SSE 推送）

## 贡献指南

欢迎 Issue / PR！提交前请确保：

```bash
npm run lint
npm run build
```

## 许可证

MIT License，详见 [LICENSE](./LICENSE)。欢迎二次开发与商用，记得保留版权与链接。
