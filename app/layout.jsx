import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import PwaSetup from "@/components/PwaSetup";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata = {
  title: "Fleming Realty Group",
  description: "Property management — work orders, inspections, and resident services.",
  manifest: "/manifest.webmanifest",
  applicationName: "Fleming",
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iOS ignores the manifest for home-screen launch behaviour and needs these.
  appleWebApp: {
    capable: true,
    title: "Fleming",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#1F2EAD",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Required for the app to draw under the notch/home indicator so that
  // env(safe-area-inset-*) reports real values.
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
