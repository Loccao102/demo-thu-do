import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudFit — AI Virtual Try-On Demo",
  description: "Cloud-only virtual try-on demo using a free-trial API tier."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
