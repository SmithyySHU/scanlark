(function () {
  try {
    var stored = localStorage.getItem("theme");
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var mode =
      stored === "dark" || stored === "light"
        ? stored
        : prefersDark
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = mode;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
