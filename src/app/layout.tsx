import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Commit Atlas — commit activity across repositories",
  description:
    "A dark, data-dense dashboard of commit activity across multiple GitHub repositories: 48-hour windows, 14-day rolling baselines, and barcode plots.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${workSans.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={120}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
