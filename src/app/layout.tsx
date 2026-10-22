import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "دستیار هوشمند خرید حضوری ترب | Torob Shopping Assistant",
  description: "دستیار هوشمند ایجنتیک برای خرید حضوری، مقایسه فروشگاه‌های تهران، استعلام شبیه‌سازی‌شده و صدور کارت مراجعه",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-screen bg-gray-50 flex flex-col">
        {children}
      </body>
    </html>
  );
}
