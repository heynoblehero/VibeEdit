import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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
  title: "VibeEdit Studio",
  description: "AI video editor for faceless short-form videos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Testing mode: wipe persisted project/chat state on every page load so
  // refresh = clean slate. Runs as an inline <script> so it executes BEFORE
  // zustand reads localStorage and hydrates the stores. UI prefs (theme,
  // chat-width) are left alone. Flip the "true" below to disable.
  const resetOnLoadScript = `
    (function(){
      if (!true) return;
      try {
        for (const k of ["vibeedit-project","vibeedit-chat","vibeedit-broll","vibeedit-render-queue"]) {
          localStorage.removeItem(k);
        }
      } catch (e) {}
    })();
  `;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: resetOnLoadScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          expand
          visibleToasts={5}
        />
      </body>
    </html>
  );
}
