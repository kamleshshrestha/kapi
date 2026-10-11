import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteFooter from "@/components/v2/SiteFooter";
import SyncRunner from "@/components/v2/SyncRunner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kapi",
  description:
    "You think you understand it. Kapi finds out if you do. Explain a machine-learning concept in your own words and find the specific gap.",
  openGraph: {
    title: "Kapi",
    description: "You think you understand it. Kapi finds out if you do.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
        <SyncRunner />
      </body>
    </html>
  );
}
