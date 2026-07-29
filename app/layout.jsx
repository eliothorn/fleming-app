import "./globals.css";
import { Playfair_Display, Montserrat } from "next/font/google";
import PwaSetup from "@/components/PwaSetup";

// Fleming Realty brand fonts. Playfair Display is the heading face from the
// brand guide — a high-contrast display serif, so it's reserved for titles and
// screen headings. Montserrat carries all interface text, where Playfair's thin
// strokes would hurt legibility at small sizes on a phone.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
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
  themeColor: "#0D1B33",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Required for the app to draw under the notch/home indicator so that
  // env(safe-area-inset-*) reports real values.
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${montserrat.variable}`}>
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
