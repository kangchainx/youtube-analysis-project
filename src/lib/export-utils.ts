import type { VideoTableRow } from "@/features/home/search-input";

type ExportOptions = {
  videos: VideoTableRow[];
  channelName?: string;
  includeHotComments?: boolean;
};

const VIDEO_BASE_HEADERS = [
  "视频标题",
  "视频链接",
  "发布时间",
  "观看数",
  "点赞数",
  "评论数",
];

const HOT_COMMENT_HEADERS = ["热门评论", "热门评论点赞数", "热门评论回复数"];

const sanitizeFileName = (value: string) => {
  if (!value) return "channel-videos";
  return value.replace(/[\\/:*?"<>|]/g, "").trim() || "channel-videos";
};

const formatDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const escapeCsvCell = (value: string) => {
  if (value === "") return "";
  const needsEscaping = /[",\r\n]/.test(value);
  if (!needsEscaping) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createVideoRows = (
  videos: VideoTableRow[],
  includeHotComments: boolean,
) => {
  // 根据是否需要热门评论动态扩展表头和数据列
  const headers = includeHotComments
    ? [...VIDEO_BASE_HEADERS, ...HOT_COMMENT_HEADERS]
    : VIDEO_BASE_HEADERS;

  const rows = videos.map((video) => {
    const baseRow = [
      video.title.trim() || "未命名视频",
      `https://www.youtube.com/watch?v=${video.id}`,
      formatDate(video.publishedAt),
      video.viewCount.toString(),
      video.likeCount.toString(),
      video.commentCount.toString(),
    ];

    if (!includeHotComments) return baseRow;

    const topComment = (video.topComment ?? "").replace(/\s+/g, " ").trim();
    return [
      ...baseRow,
      topComment || "暂无评论",
      video.topCommentLikeCount.toString(),
      video.topCommentReplyCount.toString(),
    ];
  });

  return { headers, rows };
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportVideosToCsv = ({
  videos,
  channelName,
  includeHotComments = false,
}: ExportOptions) => {
  if (videos.length === 0) return;

  const { headers, rows } = createVideoRows(videos, includeHotComments);
  const csvLines = [
    headers.map((cell) => escapeCsvCell(cell)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ];
  // 写入 BOM 让 Excel 等默认用 UTF-8 正确解析中文
  const csvContent = "\uFEFF" + csvLines.join("\r\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const safeName = sanitizeFileName(channelName ?? "");
  triggerDownload(blob, `${safeName}-videos.csv`);
};

export const exportVideosToExcel = ({
  videos,
  channelName,
  includeHotComments = false,
}: ExportOptions) => {
  if (videos.length === 0) return;

  const { headers, rows } = createVideoRows(videos, includeHotComments);
  const headerHtml = headers
    .map((cell) => `<th style="background:#f4f4f5;">${escapeHtml(cell)}</th>`)
    .join("");
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="mso-number-format:'\\@';padding:4px 8px;">${escapeHtml(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const tableHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body><table border="1" cellspacing="0" cellpadding="0"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;

  const blob = new Blob([tableHtml], {
    type: "application/vnd.ms-excel",
  });
  const safeName = sanitizeFileName(channelName ?? "");
  triggerDownload(blob, `${safeName}-videos.xls`);
};
