import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Image from "./next-image";
import { imageSources } from "@/lib/images/image-sources";
afterEach(cleanup);
const image = "https://musiccity.pro/media/images/v1/signed.key/768.webp";
it("requests responsive artwork sizes and defers off-screen images", () => {
  render(<Image src={image} alt="Cover" sizes="48px" maxWidth={192} width={48} height={48} />);
  const artwork = screen.getByRole("img", { name: "Cover" });
  expect(artwork.getAttribute("srcset")).toContain("96.webp 96w");
  expect(artwork.getAttribute("srcset")).toContain("192.webp 192w");
  expect(artwork.getAttribute("srcset")).not.toContain("768.webp");
  expect(artwork.getAttribute("sizes")).toBe("48px");
  expect(artwork.getAttribute("loading")).toBe("lazy");
  expect(artwork.getAttribute("decoding")).toBe("async");
});
it("prioritizes the hero and uses bundled optimized assets", () => {
  render(<Image src="/images/landing/musiccity-hero.png" alt="Hero" priority sizes="50vw" />);
  const hero = screen.getByRole("img", { name: "Hero" });
  expect(hero.getAttribute("loading")).toBe("eager");
  expect(hero.getAttribute("fetchpriority")).toBe("high");
  expect(hero.getAttribute("src")).toContain(".webp");
  expect(hero.getAttribute("srcset")).toContain("1600w");
});
it("keeps local previews, SVGs and external avatars as their original resource types", () => {
  for (const src of ["blob:local-preview", "/placeholder.svg", "https://avatar.example/photo.jpg"]) {
    expect(imageSources(src).src).toBe(src);
    expect(imageSources(src)).not.toHaveProperty("srcSet");
  }
});
