import type { CSSProperties, ImgHTMLAttributes } from "react";
import { imageSources } from "@/lib/images/image-sources";

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
    style={imageStyle}
  />;
};
export default Image;
