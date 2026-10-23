import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/800.css";

export const metadata: Metadata = {
  title: "کاوشگران | همراه خرید حضوری ترب",
  description: "همراه هوشمند خرید حضوری؛ انتخاب محصول، مقایسهٔ فروشگاه‌های نزدیک و برنامه‌ریزی مراجعه در تهران",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans min-h-screen bg-gray-50 flex flex-col">
        {children}
      </body>
    </html>
  );
}
