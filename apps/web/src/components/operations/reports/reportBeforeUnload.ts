type BeforeUnloadTarget = {
  addEventListener(
    type: "beforeunload",
    listener: (event: BeforeUnloadEvent) => void,
  ): void;
  removeEventListener(
    type: "beforeunload",
    listener: (event: BeforeUnloadEvent) => void,
  ): void;
};

export function preventReportUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Legacy compatibility: the HTML contract requires a non-empty value.
  event.returnValue = "true";
}

export function registerReportBeforeUnloadGuard(
  target: BeforeUnloadTarget,
  hasUnsavedChanges: boolean,
) {
  if (!hasUnsavedChanges) return () => {};

  target.addEventListener("beforeunload", preventReportUnload);
  let listening = true;
  return () => {
    if (!listening) return;
    listening = false;
    target.removeEventListener("beforeunload", preventReportUnload);
  };
}
