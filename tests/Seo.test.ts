import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve("index.html"), "utf8");
const robots = readFileSync(resolve("resources/robots.txt"), "utf8");
const sitemap = readFileSync(resolve("resources/sitemap.xml"), "utf8");

describe("site SEO", () => {
  it("canonical and Open Graph point at maraudersea.com, not GitHub", () => {
    expect(indexHtml).toContain(
      '<link rel="canonical" href="https://maraudersea.com/" />',
    );
    expect(indexHtml).toContain(
      '<meta property="og:url" content="https://maraudersea.com/" />',
    );
    expect(indexHtml).not.toContain(
      "https://github.com/DigitalGoliath2024/Ancientfront",
    );
  });

  it("has a description, Twitter card, and VideoGame JSON-LD", () => {
    expect(indexHtml).toMatch(/<meta\s+name="description"/);
    expect(indexHtml).toContain('name="twitter:card"');
    expect(indexHtml).toContain('type="application/ld+json"');
    expect(indexHtml).toContain('"@type": "VideoGame"');
    expect(indexHtml).toContain("https://openfront.io/");
  });

  it("exposes crawlable homepage copy", () => {
    expect(indexHtml).toContain('id="about-marauders-sea"');
    expect(indexHtml).toContain("data-i18n=\"main.seo_blurb\"");
  });

  it("lists the sitemap from robots.txt", () => {
    expect(robots).toContain("Sitemap: https://maraudersea.com/sitemap.xml");
    expect(sitemap).toContain("<loc>https://maraudersea.com/</loc>");
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/terms-of-service.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/privacy-policy.html</loc>",
    );
  });
});
