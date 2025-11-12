import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import DetailPage from "./pages/DetailPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ProfilePage from "./pages/ProfilePage";
import AppLayout from "@/layouts/AppLayout";
import WorkbenchLayout from "@/layouts/WorkbenchLayout";
import { RequireAuth } from "@/routes/RequireAuth";
import DashboardPage from "@/pages/workbench/Dashboard";
import SubscriptionsPage from "@/pages/workbench/Subscriptions";
import AnalyticsPage from "@/pages/workbench/Analytics";
import TasksPage from "@/pages/workbench/Tasks";
import NotificationsPage from "@/pages/workbench/Notifications";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/google/callback" element={<AuthCallbackPage />} />
        <Route
          element={
            <RequireAuth>
              <Outlet />
            </RequireAuth>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/detail/:videoId" element={<DetailPage />} />
          <Route path="/workbench" element={<WorkbenchLayout />}>
            <Route
              index
              element={<Navigate to="/workbench/dashboard" replace />}
            />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
