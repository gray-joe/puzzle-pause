import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Puzzle Pause",
  description: "Daily word and logic puzzles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: 20, minHeight: "100vh" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
