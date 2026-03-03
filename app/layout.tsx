import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CopyVideo - 一键 AI 视频复刻",
  description: "极简单页 AI 视频复刻原型"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
