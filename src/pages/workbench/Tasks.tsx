import { useTranscriptionTasks } from "@/contexts/TranscriptionTasksContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DownloadCloud, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "已失败",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-100",
  processing: "bg-blue-50 text-blue-700 border border-blue-100",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  failed: "bg-rose-50 text-rose-700 border border-rose-100",
};

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return "未知大小";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
};

function TasksPage() {
  const { tasks } = useTranscriptionTasks();

  const hasTasks = tasks.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">任务中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理所有“转文字”任务进度并下载结果。
        </p>
      </div>

      <div className="rounded-xl border bg-background p-4 shadow-sm sm:p-6">
        {hasTasks ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="min-w-[220px]">进度</TableHead>
                <TableHead className="text-right">下载</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const primaryFile = task.files?.[0];
                const displayName = primaryFile?.fileName || task.title;
                const statusLabel =
                  STATUS_LABELS[task.status] ?? task.status ?? "未知状态";
                const statusClasses =
                  STATUS_STYLES[task.status] ?? "bg-muted text-foreground/70";
                const progressLabel =
                  task.progress === null
                    ? task.status === "completed" && !primaryFile
                      ? "文件生成中..."
                      : "处理中..."
                    : `${task.progress}%`;
                const canDownload =
                  task.status === "completed" && (task.files?.length ?? 0) > 0;
                return (
                  <TableRow key={task.id}>
                    <TableCell className="w-full">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{displayName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          创建于 {formatDate(task.createdAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          statusClasses,
                        )}
                      >
                        {statusLabel}
                      </span>
                      {task.error ? (
                        <p className="mt-1 text-xs text-destructive">
                          {task.error}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="space-y-1">
                        <Progress
                          value={task.progress ?? undefined}
                          indeterminate={task.progress === null}
                        />
                        <p className="text-xs text-muted-foreground">
                          {progressLabel}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {canDownload ? (
                        <div className="flex flex-col items-end gap-2">
                          {task.files.map((file) => (
                            <div key={file.id} className="flex flex-col items-end gap-1">
                              <p className="text-xs text-muted-foreground">
                                {file.fileName} · {file.fileFormat?.toUpperCase()} ·{" "}
                                {formatFileSize(file.fileSize)}
                              </p>
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={file.filePath}
                                  download={file.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <DownloadCloud className="h-4 w-4" />
                                  下载
                                </a>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {task.status === "completed"
                            ? "文件生成中..."
                            : "任务完成后可下载"}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <FileText className="h-10 w-10 text-muted-foreground/70" />
            <div>
              <p className="font-medium text-foreground">暂无任务</p>
              <p className="mt-1 text-sm text-muted-foreground">
                在视频详情页点击“转文字”即可创建任务并在此查看进度。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TasksPage;
