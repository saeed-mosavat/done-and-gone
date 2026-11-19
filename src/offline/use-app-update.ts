import { useEffect, useState } from "react";

export function useAppUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker>();
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let hadController = !!navigator.serviceWorker.controller;
    function changed() {
      if (hadController && navigator.serviceWorker.controller)
        setWaiting(navigator.serviceWorker.controller);
      hadController = true;
    }
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    const watched = new Set<ServiceWorker>();
    function check() {
      if (!disposed && registration?.waiting && registration.active)
        setWaiting(registration.waiting);
      const worker = registration?.installing;
      if (worker && !watched.has(worker)) {
        watched.add(worker);
        worker.addEventListener("statechange", check);
      }
    }
    function refresh() {
      if (document.visibilityState === "visible")
        void registration?.update().catch(() => {});
    }
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((value) => {
        if (disposed) return;
        registration = value;
        registration.addEventListener("updatefound", check);
        check();
      })
      .catch(() => {
        // A failed preparation must not block the locally stored board.
      });
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      registration?.removeEventListener("updatefound", check);
      for (const worker of watched)
        worker.removeEventListener("statechange", check);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  function apply() {
    if (!waiting) return;
    if (waiting.state === "activated" || waiting.state === "redundant") {
      window.location.reload();
      return;
    }
    // Only this explicit requester reloads. Other tabs retain their live drafts.
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true }
    );
    waiting.postMessage("APPLY_UPDATE");
  }
  return { available: !!waiting, apply };
}
