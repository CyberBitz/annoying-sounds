
(() => {
  const audio = new Audio();
  audio.preload = "auto";

  // Utilities
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const fmtWindow = (minS, maxS) => `${Math.round(minS / 60)}–${Math.round(maxS / 60)} min`;

  const fmtCountdown = (msLeft) => {
    if (msLeft == null) return "—";
    const s = Math.max(0, Math.ceil(msLeft / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };

  const fmtAgo = (msAgo) => {
    if (msAgo == null) return "—";
    const s = Math.floor(msAgo / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s ago`;
  };

  function wire(container) {
    // Hard guard: never wire the same container twice
    if (container.dataset.wired === "1") return;
    container.dataset.wired = "1";

    const src = container.dataset.sound;
    if (!src) return;

    // Elements
    const btnStart = container.querySelector('[data-action="arm"]');
    const btnNow = container.querySelector('[data-action="playNow"]');
    const btnPlus = container.querySelector('[data-action="expand"]');
    const btnMinus = container.querySelector('[data-action="shrink"]');

    const elWindow = container.querySelector("[data-window]");
    const elLast = container.querySelector("[data-last]");
    const elNext = container.querySelector("[data-next]");
    const elProgress = container.querySelector("[data-progress]");

    // State (kept intentionally small)
    let minSec = 60;
    let maxSec = 300;

    let running = false;

    // Next scheduled play (one at a time)
    let scheduledAt = 0; // ms
    let fireAt = 0;      // ms
    let timeoutId = null;

    // UI refresh only
    let uiIntervalId = null;

    // Last random play (scheduled only)
    let lastRandomAt = null;

    // A generation token: invalidates any previously scheduled timeouts
    // (prevents any "ghost" timeouts from firing after resets)
    let gen = 0;

    // ---------- UI helpers ----------
    function setStartLabel() {
      if (!btnStart) return;
      btnStart.textContent = running ? "Stop" : "Start";
      btnStart.setAttribute("aria-pressed", running ? "true" : "false");
    }

    function setProgress(pct) {
      if (!elProgress) return;
      elProgress.style.width = `${clamp(pct, 0, 100)}%`;
    }

    function updateUI() {
      if (elWindow) elWindow.textContent = fmtWindow(minSec, maxSec);

      if (elLast) elLast.textContent = lastRandomAt ? fmtAgo(Date.now() - lastRandomAt) : "—";

      if (!running || !fireAt || !scheduledAt) {
        if (elNext) elNext.textContent = "—";
        setProgress(0);
        return;
      }

      const now = Date.now();
      const msLeft = fireAt - now;
      if (elNext) elNext.textContent = fmtCountdown(msLeft);

      const total = Math.max(1, fireAt - scheduledAt);
      const elapsed = clamp(now - scheduledAt, 0, total);
      setProgress((elapsed / total) * 100);
    }

    function startUiLoop() {
      if (uiIntervalId) clearInterval(uiIntervalId);
      uiIntervalId = setInterval(updateUI, 200);
    }

    function stopUiLoop() {
      if (uiIntervalId) clearInterval(uiIntervalId);
      uiIntervalId = null;
    }

    // ---------- Scheduling (ONE timeout at a time) ----------
    function clearSchedule() {
      gen++; // invalidate any pending timeout callbacks
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      scheduledAt = 0;
      fireAt = 0;
    }

    function scheduleNext(resetTimer = false) {
      // Only schedule if running
      if (!running) return;

      // Kill any existing schedule FIRST
      clearSchedule();

      const delaySec = randInt(minSec, maxSec);
      const now = Date.now();
      scheduledAt = now;
      fireAt = now + delaySec * 1000;

      const myGen = gen; // capture current generation

      timeoutId = setTimeout(async () => {
        // If we were reset/stopped since scheduling, do nothing
        if (!running || myGen !== gen) return;

        // Play scheduled sound (single play)
        await playScheduledOnce();

        // After it plays, immediately schedule exactly ONE next play
        if (running && myGen === gen) {
          scheduleNext(false);
        }
      }, delaySec * 1000);

      if (resetTimer) {
        // nothing else; schedule already reset
      }
    }

    async function playScheduledOnce() {
      try {
        // Make absolutely sure we only play once: pause & reset first.
        // (If the file is short, overlapping can sound like multiple plays.)
        audio.pause();
        audio.currentTime = 0;

        // Ensure correct source (root file)
        if (audio.src !== new URL(src, window.location.href).href) {
          audio.src = src;
        }

        // IMPORTANT: force loop off
        audio.loop = false;

        // Play
        await audio.play();

        // Only scheduled plays update "last played"
        lastRandomAt = Date.now();
      } catch (e) {
        // If browser blocks playback, we just don't schedule chaos.
        console.warn("Scheduled play failed:", e);
      }
    }

    async function playNowOnly() {
      // No schedule changes, no UI label changes, no lastRandomAt changes
      try {
        audio.pause();
        audio.currentTime = 0;

        if (audio.src !== new URL(src, window.location.href).href) {
          audio.src = src;
        }

        audio.loop = false;

        await audio.play();
      } catch (e) {
        console.warn("Play Now failed:", e);
      }
    }

    // ---------- Controls ----------
    function start() {
      running = true;
      setStartLabel();
      startUiLoop();
      scheduleNext(true); // Start always resets timer
      updateUI();
    }

    function stop() {
      running = false;
      setStartLabel();
      clearSchedule();
      stopUiLoop();
      updateUI();
    }

    function toggle() {
      if (running) stop();
      else start();
    }

    function expandWindow() {
      minSec = clamp(minSec + 60, 30, 60 * 60);
      maxSec = clamp(maxSec + 60, minSec + 30, 60 * 60 * 2);
      if (running) scheduleNext(true);
      updateUI();
    }

    function shrinkWindow() {
      minSec = clamp(minSec - 60, 30, 60 * 60);
      maxSec = clamp(maxSec - 60, minSec + 30, 60 * 60 * 2);
      if (running) scheduleNext(true);
      updateUI();
    }

    // ---------- Event wiring ----------
    btnStart?.addEventListener("click", (e) => {
      e.preventDefault();
      toggle();
    });

    btnNow?.addEventListener("click", async (e) => {
      e.preventDefault();
      await playNowOnly();
      // Intentionally no UI updates per your spec
    });

    btnPlus?.addEventListener("click", (e) => {
      e.preventDefault();
      expandWindow();
    });

    btnMinus?.addEventListener("click", (e) => {
      e.preventDefault();
      shrinkWindow();
    });

    // Initialize UI
    setStartLabel();
    updateUI();

    // Safety cleanup on navigation
    window.addEventListener("pagehide", () => {
      stop();
      audio.pause();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".media-controls[data-sound]").forEach(wire);
  });
})();
