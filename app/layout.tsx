import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Private Mailroom",
  description: "Your private domain email workspace.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" content="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
