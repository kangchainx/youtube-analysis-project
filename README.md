<div align="center">

[![youtube-analysis-project](https://socialify.git.ci/kangchainx/youtube-analysis-project/image?custom_language=React&description=1&font=Inter&language=1&name=1&owner=1&theme=Light)](https://github.com/kangchainx/youtube-analysis-project)

<!-- Badges -->
<p>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License MIT">
  </a>
  <a href="https://github.com/kangchainx/youtube-analysis-project/stargazers">
    <img src="https://img.shields.io/github/stars/kangchainx/youtube-analysis-project.svg" alt="GitHub stars">
  </a>
  <a href="https://github.com/kangchainx/youtube-analysis-project/network/members">
    <img src="https://img.shields.io/github/forks/kangchainx/youtube-analysis-project.svg" alt="GitHub forks">
  </a>
  <a href="https://github.com/kangchainx/youtube-analysis-project/issues">
    <img src="https://img.shields.io/github/issues/kangchainx/youtube-analysis-project.svg" alt="GitHub issues">
  </a>
</p>

<!-- Language Switcher -->
<p>
  <strong>English</strong> | <a href="./README_zh.md">中文</a>
</p>

</div>

---

## 📊 YouTube Analysis Platform

A modern YouTube channel analytics and video transcription dashboard. Built with React 19 + TypeScript + Vite, featuring real-time SSE updates, channel analytics, video transcription tasks, and notifications.

**Backend Repository**: [youtube-analysis-backend](https://github.com/kangchainx/youtube-analysis-backend)

> If this project helps you, please give it a Star 🌟 - your support motivates continuous development!

## ✨ Key Features

- **📈 Channel Search & Insights**: Search channels by name or @handle, view key metrics (subscribers, views, videos), with table/card dual views and pagination
- **🎬 Transcription Task Center**: Create and track video transcription tasks via `/api/video-translate/*`, real-time SSE progress streaming, download results in Markdown/TXT format
- **🔔 Notification Stream**: SSE-powered task/system notifications, real-time unread count updates, batch/individual mark-as-read
- **🏥 Service Health Dashboard**: Monitor transcription service status with one-click refresh, dark mode optimized
- **♿ Responsive & Accessible**: Built with Radix UI + Tailwind CSS, skeleton screens, empty states, full dark/light theme support
- **🚀 One-Click Deployment**: Dockerfile and docker-compose for seamless full-stack deployment with local reverse proxy

## 🎬 Demo

<div align="center">
  <img src="./public/demo/youtube-analysis-project.gif" alt="YouTube Analysis Demo" width="100%" />
</div>

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- Backend service: [youtube-analysis-backend](https://github.com/kangchainx/youtube-analysis-backend) (default API base: `http://localhost:5001`)
- Optional: Create `.env.local` or `.env` in project root:

```bash
VITE_API_BASE_URL=http://localhost:5001    # Custom backend URL
# Only used as fallback if backend doesn't provide /api/config/youtube-api-key
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

### Local Development

```bash
npm install
npm run dev
# Open browser at http://localhost:5173
```

**Available Scripts**:
- `npm run lint` - Code quality check
- `npm run build` - Production build
- `npm run preview` - Preview production build locally

### Docker Deployment

**Frontend Only** (requires separate backend):

```bash
docker build -t youtube-analysis-frontend:latest .
docker run -d -p 8080:80 --name youtube-frontend youtube-analysis-frontend:latest
```

**Full Stack** (recommended - after building backend image):

```bash
BACKEND_IMAGE=youtube-analysis-backend:latest docker-compose up --build
# Add -d flag for background mode
```

## 📸 Screenshots

<details>
<summary>Click to view screenshots</summary>

![Login Page](./public/screenshot/login_page.png)
![Home Page](./public/screenshot/home_page.png)
![Search Results - Table View](./public/screenshot/search_result_table_page.png)
![Search Results - Card View](./public/screenshot/search_result_card_page.png)
![Channel Details](./public/screenshot/search_result_detail_page.png)
![User Profile](./public/screenshot/profile_page.png)

</details>

## 🛠️ Tech Stack

- **Frontend Framework**: React 19.1.1 + TypeScript 5.6
- **Build Tool**: Vite 7
- **Routing**: React Router 7.9.4
- **UI Components**: Radix UI + Tailwind CSS 4 + shadcn/ui
- **Charts**: Recharts 3.4.1
- **Real-time**: Server-Sent Events (SSE)
- **Icons**: Lucide Icons
- **Notifications**: Sonner Toast

## 🗺️ Routing Structure

- `/login` - User login
- `/register` - User registration
- `/home` - Channel search and discovery
- `/detail/:videoId` - Video details and transcription creation
- `/profile` - User profile settings
- `/workbench/dashboard` - Metrics overview + service health
- `/workbench/subscriptions` - Channel subscription management
- `/workbench/analytics` - Channel analytics and insights
- `/workbench/tasks` - Transcription task center (SSE real-time updates)
- `/workbench/notifications` - Notification center (SSE streaming)

## 🤝 Contributing

Contributions are welcome! Please ensure the following before submitting:

```bash
npm run lint
npm run build
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details. Free for commercial use, attribution appreciated.

---

<div align="center">

**Made with ❤️ by [kangchainx](https://github.com/kangchainx)**

</div>
