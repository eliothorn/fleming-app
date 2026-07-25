// Web app manifest — this is what makes the app installable on a phone's home
// screen and launch without browser chrome.
export default function manifest() {
  return {
    name: "Fleming Realty Group",
    short_name: "Fleming",
    description:
      "Maintenance requests, work orders, inspections and property updates for Fleming Realty residents, owners, vendors and staff.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0D0D0D",
    theme_color: "#1F2EAD",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android adaptive icons crop to a circle; the maskable art is inset for it.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
