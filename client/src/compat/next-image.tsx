import type { CSSProperties, ImgHTMLAttributes } from "react";
import { imageSources } from "@/lib/images/image-sources";

const unavailableImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#141827"/><stop offset="1" stop-color="#090c16"/></linearGradient><linearGradient id="disc" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#24d49a"/><stop offset="1" stop-color="#7c7cff"/></linearGradient></defs><rect width="160" height="160" rx="18" fill="url(#bg)"/><circle cx="80" cy="80" r="52" fill="none" stroke="#263047" stroke-width="2"/><circle cx="80" cy="80" r="39" fill="url(#disc)" opacity=".24"/><circle cx="80" cy="80" r="8" fill="#d9e2f2" opacity=".88"/><path d="M96 48v45a13 10 0 1 1-5-8V55l29-6v35a13 10 0 1 1-5-8V43z" fill="#e8edf7"/><path d="M96 48l24-5v8l-24 5z" fill="#24d49a"/></svg>',
)}`;

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  maxWidth?: number;
};

const Image = ({ fill, style, sizes = "100vw", priority = false, maxWidth = 1600, ...props }: ImageProps) => {
  const imageStyle: CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : { ...style };
  return <img
    {...props}
    {...imageSources(props.src, sizes, maxWidth)}
    loading={priority ? "eager" : props.loading ?? "lazy"}
    fetchPriority={priority ? "high" : props.fetchPriority ?? "auto"}
    decoding={props.decoding ?? "async"}
    onError={(event) => {
      const image = event.currentTarget;
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      image.removeAttribute("srcset");
      image.src = unavailableImage;
      props.onError?.(event);
    }}
    style={imageStyle}
  />;
};
export default Image;
