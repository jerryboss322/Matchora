import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "JPredict — Football Analysis Platform",
  description:
    "Data-driven football prediction platform. Real fixtures, real odds, calculated confidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="bg-surface-base text-text-primary antialiased min-h-screen">
        <NavBar />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
