import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import ArthurVoice from "../components/voice/ArthurVoice";
import { SessionProvider } from "../components/context/SessionContext";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DanielOS",
  description: "High-Performance Neural Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#050505] text-stone-400 h-screen w-screen overflow-hidden`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SessionProvider>
            {/* Now the Chat and ArthurVoice share the same memory */}
            {children}
            <Toaster />
            <ArthurVoice />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}