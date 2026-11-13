import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description = "An AI voice version of Utkarsh Sawant. Tap the mic, ask a question, and hear his answer.";

export const metadata: Metadata = {
  metadataBase: new URL("https://voice-bot-lime.vercel.app"),
  title: "Talk to Utkarsh",
  description,
  openGraph: { title: "Talk to Utkarsh", description, type: "website" },
  twitter: { card: "summary_large_image", title: "Talk to Utkarsh", description },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1020", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
