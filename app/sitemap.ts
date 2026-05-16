import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://grynd.com.br";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, priority: 1, changeFrequency: "weekly" },
    { url: `${base}/pricing`, lastModified: now, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/legal/termos`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/legal/privacidade`, lastModified: now, priority: 0.3, changeFrequency: "yearly" }
  ];
}
