import { useEffect } from "react";
import { storeConfig } from "../config/store";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${storeConfig.brandName}` : storeConfig.brandName;
  }, [title]);
}
