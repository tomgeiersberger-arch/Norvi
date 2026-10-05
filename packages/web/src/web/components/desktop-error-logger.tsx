import { useEffect } from "react";
import { isDesktop } from "../lib/desktop";
import { recordLocalError } from "../lib/local-error-log";

export function DesktopErrorLogger() {
  useEffect(() => {
    if (!isDesktop()) return;

    const onError = (event: ErrorEvent) => {
      recordLocalError("error", event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      recordLocalError("rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
