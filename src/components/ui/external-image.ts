import { createElement, type ImgHTMLAttributes } from "react";

type ExternalImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
};

export function ExternalImage(props: ExternalImageProps) {
  return createElement("img", props);
}
