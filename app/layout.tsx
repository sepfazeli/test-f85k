import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Test",
  description: "A creative portfolio showcasing design work, projects, and creative output with an about section and contact information",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}