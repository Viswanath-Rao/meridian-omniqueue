/**
 * motion.js - Kinetic Typography, Magnetic Elements & Interactive Motion
 */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  // Kinetic Type Splitter
  const splitKinetic = (el) => {
    if (!el) return;
    const text = el.dataset.kinetic || el.textContent;
    el.textContent = "";
    let i = 0;
    text.split(/(\s+)/).forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        el.appendChild(document.createTextNode(" "));
        return;
      }
      const word = document.createElement("span");
      word.className = "word";
      [...token].forEach((ch) => {
        const span = document.createElement("span");
        span.className = "char";
        span.style.setProperty("--d", i);
        span.textContent = ch;
        word.appendChild(span);
        i += 1;
      });
      el.appendChild(word);
    });
  };

  document.querySelectorAll("[data-kinetic]").forEach(splitKinetic);

  // Magnetic Buttons on Desktop
  if (!coarse && !reduce) {
    document.addEventListener("pointermove", (e) => {
      document.querySelectorAll(".magnetic").forEach((el) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < 80) {
          el.style.transform = `translate(${dx * 0.16}px, ${dy * 0.16}px)`;
        } else {
          el.style.transform = "";
        }
      });
    });
  }

  // Scroll Progress
  window.addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    document.documentElement.style.setProperty("--scroll", p.toFixed(4));
  }, { passive: true });

  // Theme Toggle
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const themeLabel = document.querySelector("[data-theme-label]");
  themeToggle?.addEventListener("click", () => {
    const isDay = document.body.classList.toggle("day");
    if (themeLabel) themeLabel.textContent = isDay ? "Night" : "Day";
  });

  // Global Toast Dispatcher
  window.showToast = (msg, type = "info") => {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✓" : type === "alert" ? "⚠" : "ℹ";
    toast.innerHTML = `<span style="font-weight:700;">${icon}</span> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(12px)";
      setTimeout(() => toast.remove(), 350);
    }, 3800);
  };
})();
