import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "ApexStudios — AI Image & Video Studio by ApexDevLabs",
  description:
    "Generate AI images and videos with 200+ models. ApexStudios by ApexDevLabs — the open-source creative AI studio.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
