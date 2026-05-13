import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smintos — The Business OS for Home Service Companies",
  description:
    "Smintos is the all-in-one business operating system for home service businesses. Pipelines, automations, AI employees, and reporting in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
