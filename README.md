# YouTube 频道分析项目

## 功能介绍

- 支持按频道名称或 @handle 搜索，自动请求 YouTube Data API 获取频道元数据与视频列表
- 可切换全站搜索模式并显示搜索建议，提供更精确的频道选择体验
- 展示频道简介、订阅数、视频总数、总观看数等关键指标
- 视频列表按发布时间倒序排列，包含观看、点赞、收藏、评论等统计，并支持分页浏览
- 通过骨架屏与空状态组件提供有反馈的加载体验，并在搜索面板中加入折叠与确认弹窗交互

## 功能截图

<!-- TODO: 在此添加项目截图，例如使用 Markdown 图片语法或 HTML 标签 -->

![alt text](./public/login.png)
![alt text](./public/search.png)
![alt text](./public/video-result.png)

## 技术栈说明

| 技术           | 图标                                                                                                                                                 | 说明                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| React 19       | <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" alt="React" width="24" height="24" />                         | 构建组件化用户界面，处理搜索与列表的交互逻辑     |
| TypeScript     | <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" alt="TypeScript" width="24" height="24" />          | 提供静态类型约束，提升开发阶段的可维护性与可读性 |
| Vite           | <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg" alt="Vite" width="24" height="24" />                        | 作为构建工具，提供极速开发服务器与按需打包能力   |
| Tailwind CSS 4 | <img src="https://img.shields.io/badge/Tailwind%20CSS-38B2AC?logo=tailwindcss&logoColor=white&style=for-the-badge" alt="Tailwind CSS" height="24" /> | 通过原子化样式快速构建响应式界面                 |
| Radix UI       | <img src="https://avatars.githubusercontent.com/u/75042455?s=200&v=4" alt="Radix UI" width="24" height="24" />                                       | 提供无障碍的基础组件（如对话框、开关、选择器等） |
| Lucide Icons   | <img src="https://img.shields.io/badge/Lucide-18181B?logo=lucide&logoColor=white&style=for-the-badge" alt="Lucide" height="24" />                    | 统一的矢量图标库，增强界面视觉反馈               |

## 更新日志

### v0.0.0

- 初始化项目结构（React + TypeScript + Vite）与基础开发环境
- 新增频道搜索、建议列表、全站搜索确认弹窗等基础交互
- 接入 YouTube Data API v3，展示频道元数据与视频统计
- 实现视频分页、骨架屏加载状态与空状态反馈

## 快速开始

### 环境准备

- Node.js 18 或以上版本
- 有效的 YouTube Data API v3 Key

### 本地运行

1. 安装依赖
   ```bash
   npm install
   ```
2. 配置环境变量，在项目根目录创建 `.env.local`（或 `.env`）文件并写入：
   ```bash
   VITE_YOUTUBE_API_KEY=你的_API_Key
   ```
3. 启动开发服务器
   ```bash
   npm run dev
   ```
4. 打开浏览器访问终端输出的地址（默认 `http://localhost:5173`）开始调试

### 构建与预览

```bash
npm run build
npm run preview
```

## 许可证说明

项目当前尚未指定开源许可证，默认保留所有权利。如需开源或对外发布，请补充许可证文件并同步更新本段说明。
