import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClipForge AI | Viral Shorts & Captions Generator",
  description: "Transform your long form videos and YouTube URLs into viral 9:16 vertical clips with animated karaoke subtitles and AI virality scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-indigo-500/30">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

