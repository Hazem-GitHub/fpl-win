import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { deadlineLabel } from "@/lib/format";
import { getSnapshot } from "@/lib/snapshot";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pitch — Fantasy Premier League expected points",
  description:
    "Expected-points rankings, legal squad builder, and weekly transfer, captain, and chip advice for Fantasy Premier League 2026/27.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let deadline = "";
  try {
    const snapshot = await getSnapshot();
    deadline = `${snapshot.upcoming.name} · ${deadlineLabel(snapshot.upcoming.deadline_time)}`;
  } catch {
    deadline = "";
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full min-w-0 flex-col">
        <AppShell deadline={deadline}>{children}</AppShell>
      </body>
    </html>
  );
}
