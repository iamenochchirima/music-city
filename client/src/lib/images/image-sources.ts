const widths = [96, 192, 384, 768, 1200, 1600];
const bundled = import.meta.glob<string>("../../assets/optimized/**/*.webp", { eager: true, query: "?url&no-inline", import: "default" });

export function imageSources(source: string, sizes = "100vw", maximumWidth = 1600) {
  const available = widths.filter((width) => width <= maximumWidth);
  const variant = (width: number) => {
    if (/\/media\/images\/v1\/[^/]+\/\d+\.webp(?:\?.*)?$/.test(source)) {
      return source.replace(/\/\d+\.webp(?:\?.*)?$/, `/${width}.webp`);
    }
    if (source.startsWith("/") && !source.startsWith("//")) {
      return bundled[`../../assets/optimized${source}/${width}.webp`];
    }
    return undefined;
  };
  const variants = available.map((width) => ({ width, src: variant(width) })).filter((item) => item.src);
  if (!variants.length) return { src: source, sizes };
  return {
    src: variants.find((item) => item.width >= Math.min(768, maximumWidth))?.src ?? variants[variants.length - 1].src!,
    srcSet: variants.map((item) => `${item.src} ${item.width}w`).join(", "),
    sizes,
  };
}
