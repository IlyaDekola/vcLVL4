let overlayEl = null;
let countdownId = null;
let previousOverflow = "";
let currentBreakEndsAt = null;
let catScaleWrapEl = null;
let visualViewportResizeHandler = null;
let windowResizeHandler = null;
let isEnabled = true;

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PING_CONTENT_SCRIPT") {
    return;
  }

  if (message?.type === "SHOW_CAT_OVERLAY") {
    if (!isEnabled) return;
    showCatOverlay(message.breakEndsAt);
  }

  if (message?.type === "HIDE_CAT_OVERLAY") {
    hideCatOverlay(false);
  }
});

initOverlayState();
subscribeToStorageChanges();

async function initOverlayState() {
  try {
    const [breakState, settings] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_BREAK_STATE" }),
      chrome.storage.sync.get(["enabled"])
    ]);

    isEnabled = settings.enabled ?? true;

    if (!isEnabled) {
      hideCatOverlay(false);
      return;
    }

    if (
      breakState?.isOnBreak &&
      typeof breakState.breakEndsAt === "number" &&
      breakState.breakEndsAt > Date.now()
    ) {
      showCatOverlay(breakState.breakEndsAt);
    }
  } catch (error) {
    console.warn("Failed to restore overlay state", error);
  }
}

function subscribeToStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    if (!changes.enabled) return;

    isEnabled = changes.enabled.newValue ?? true;

    if (!isEnabled) {
      hideCatOverlay(false);
      return;
    }

    restoreOverlayIfBreakIsActive();
  });
}

async function restoreOverlayIfBreakIsActive() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_BREAK_STATE" });

    if (
      response?.isOnBreak &&
      typeof response.breakEndsAt === "number" &&
      response.breakEndsAt > Date.now()
    ) {
      showCatOverlay(response.breakEndsAt);
    } else {
      hideCatOverlay(false);
    }
  } catch (error) {
    console.warn("Failed to restore overlay after toggle", error);
  }
}

async function showCatOverlay(breakEndsAtFromMessage) {
  if (!isEnabled) return;

  const effectiveBreakEndsAt =
    typeof breakEndsAtFromMessage === "number" ? breakEndsAtFromMessage : null;

  if (!effectiveBreakEndsAt || effectiveBreakEndsAt <= Date.now()) return;

  currentBreakEndsAt = effectiveBreakEndsAt;

  if (countdownId) {
    clearInterval(countdownId);
    countdownId = null;
  }

  if (overlayEl) {
    const timerEl = overlayEl.querySelector("[data-timer]");
    if (timerEl) updateTimer(timerEl, currentBreakEndsAt);

    applyCatZoomCompensation();

    countdownId = setInterval(() => {
      const stillRunning = updateTimer(timerEl, currentBreakEndsAt);

      if (!stillRunning) {
        hideCatOverlay(true);
      }
    }, 1000);

    return;
  }

  overlayEl = document.createElement("div");
  overlayEl.id = "my-cat-overlay";
  overlayEl.style.position = "fixed";
  overlayEl.style.inset = "0";
  overlayEl.style.zIndex = "2147483647";
  overlayEl.style.background = "rgba(245, 232, 222, 0.65)";
  overlayEl.style.backdropFilter = "blur(12px) brightness(0.9)";
  overlayEl.style.webkitBackdropFilter = "blur(12px) brightness(0.9)";
  overlayEl.style.display = "flex";
  overlayEl.style.flexDirection = "column";
  overlayEl.style.alignItems = "center";
  overlayEl.style.justifyContent = "center";
  overlayEl.style.color = "#2b241f";
  overlayEl.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  overlayEl.style.padding = "24px";
  overlayEl.style.boxSizing = "border-box";

  const badge = document.createElement("div");
  badge.style.position = "absolute";
  badge.style.top = "20px";
  badge.style.left = "20px";
  badge.style.minWidth = "158px";
  badge.style.padding = "17px 19px";
  badge.style.borderRadius = "22px";
  badge.style.background = "rgba(40, 30, 25, 0.92)";
  badge.style.color = "#fbeee6";
  badge.style.display = "flex";
  badge.style.flexDirection = "column";
  badge.style.alignItems = "center";
  badge.style.justifyContent = "center";
  badge.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.25)";
  badge.style.textAlign = "center";
  badge.style.boxSizing = "border-box";

  const badgeLabel = document.createElement("div");
  badgeLabel.textContent = "CAT ON DUTY";
  badgeLabel.style.fontSize = "14px";
  badgeLabel.style.letterSpacing = "0.14em";
  badgeLabel.style.textTransform = "uppercase";
  badgeLabel.style.opacity = "0.9";
  badgeLabel.style.marginBottom = "9px";
  badgeLabel.style.lineHeight = "1";
  badgeLabel.style.textAlign = "center";
  badgeLabel.style.width = "100%";

  const timerEl = document.createElement("div");
  timerEl.setAttribute("data-timer", "true");
  timerEl.style.width = "100%";
  timerEl.style.textAlign = "center";
  timerEl.style.fontSize = "29px";
  timerEl.style.fontWeight = "700";
  timerEl.style.lineHeight = "1";
  timerEl.style.fontVariantNumeric = "tabular-nums";
  timerEl.style.fontFeatureSettings = "'tnum' 1, 'lnum' 1";

  badge.appendChild(badgeLabel);
  badge.appendChild(timerEl);

  const catWrapper = document.createElement("div");
  catWrapper.style.position = "absolute";
  catWrapper.style.left = "50%";
  catWrapper.style.bottom = "40px";
  catWrapper.style.transform = "translateX(-50%)";
  catWrapper.style.display = "flex";
  catWrapper.style.alignItems = "flex-end";
  catWrapper.style.justifyContent = "center";
  catWrapper.style.gap = "34px";
  catWrapper.style.width = "min(1220px, calc(100vw - 80px))";
  catWrapper.style.boxSizing = "border-box";

  const textBlock = document.createElement("div");
  textBlock.style.width = "680px";
  textBlock.style.maxWidth = "680px";
  textBlock.style.marginBottom = "36px";
  textBlock.style.background = "rgba(255, 248, 242, 0.34)";
  textBlock.style.padding = "26px 34px";
  textBlock.style.borderRadius = "22px";
  textBlock.style.boxSizing = "border-box";

  const title = document.createElement("div");
  title.textContent = "Ника дежурит. Пора сделать паузу";
  title.style.fontSize = "26px";
  title.style.fontWeight = "650";
  title.style.marginBottom = "18px";
  title.style.lineHeight = "1.2";
  title.style.maxWidth = "560px";

  const subtitle = document.createElement("div");
  subtitle.textContent =
    "Сделайте паузу, встаньте, потянитесь. Когда таймер дойдёт до нуля, Ника снова пустит вас в сеть ☀️";
  subtitle.style.fontSize = "18px";
  subtitle.style.lineHeight = "1.65";
  subtitle.style.opacity = "0.92";
  subtitle.style.maxWidth = "600px";

  textBlock.appendChild(title);
  textBlock.appendChild(subtitle);

  catScaleWrapEl = document.createElement("div");
  catScaleWrapEl.style.width = "304px";
  catScaleWrapEl.style.minWidth = "304px";
  catScaleWrapEl.style.maxWidth = "304px";
  catScaleWrapEl.style.transformOrigin = "bottom center";
  catScaleWrapEl.style.willChange = "transform";
  catScaleWrapEl.style.display = "flex";
  catScaleWrapEl.style.alignItems = "flex-end";
  catScaleWrapEl.style.justifyContent = "center";

  const catImg = document.createElement("img");
  const catUrl = chrome.runtime.getURL("assets/cat-overlay.png");
  catImg.src = catUrl;
  catImg.alt = "Nika gatekeeper";
  catImg.style.width = "304px";
  catImg.style.maxWidth = "304px";
  catImg.style.minWidth = "304px";
  catImg.style.height = "auto";
  catImg.style.display = "block";
  catImg.style.objectFit = "contain";
  catImg.style.filter = "drop-shadow(0 18px 35px rgba(0,0,0,0.35))";

  catImg.onerror = () => {
    console.error("Cat image failed to load:", catUrl);
    catScaleWrapEl.style.display = "none";
  };

  catScaleWrapEl.appendChild(catImg);

  catWrapper.appendChild(textBlock);
  catWrapper.appendChild(catScaleWrapEl);

  overlayEl.appendChild(badge);
  overlayEl.appendChild(catWrapper);

  document.documentElement.appendChild(overlayEl);

  previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  setupZoomCompensation();
  applyCatZoomCompensation();

  updateTimer(timerEl, currentBreakEndsAt);

  countdownId = setInterval(() => {
    const stillRunning = updateTimer(timerEl, currentBreakEndsAt);

    if (!stillRunning) {
      hideCatOverlay(true);
    }
  }, 1000);
}

function applyCatZoomCompensation() {
  if (!catScaleWrapEl) return;

  const scale = window.visualViewport?.scale || 1;
  const compensatedScale = 1 / scale;

  catScaleWrapEl.style.transform = `scale(${compensatedScale})`;
}

function setupZoomCompensation() {
  removeZoomCompensationListeners();

  visualViewportResizeHandler = () => {
    applyCatZoomCompensation();
  };

  windowResizeHandler = () => {
    applyCatZoomCompensation();
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", visualViewportResizeHandler);
    window.visualViewport.addEventListener("scroll", visualViewportResizeHandler);
  }

  window.addEventListener("resize", windowResizeHandler);
}

function removeZoomCompensationListeners() {
  if (window.visualViewport && visualViewportResizeHandler) {
    window.visualViewport.removeEventListener("resize", visualViewportResizeHandler);
    window.visualViewport.removeEventListener("scroll", visualViewportResizeHandler);
  }

  if (windowResizeHandler) {
    window.removeEventListener("resize", windowResizeHandler);
  }

  visualViewportResizeHandler = null;
  windowResizeHandler = null;
}

function updateTimer(timerEl, endTime) {
  const remainingMs = endTime - Date.now();

  if (remainingMs <= 0) {
    timerEl.textContent = "00:00";
    return false;
  }

  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const seconds = String(totalSec % 60).padStart(2, "0");
  timerEl.textContent = `${minutes}:${seconds}`;

  return true;
}

function hideCatOverlay(notifyBackground = false) {
  if (countdownId) {
    clearInterval(countdownId);
    countdownId = null;
  }

  removeZoomCompensationListeners();

  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }

  catScaleWrapEl = null;
  currentBreakEndsAt = null;
  document.documentElement.style.overflow = previousOverflow || "";

  if (notifyBackground) {
    chrome.runtime.sendMessage({ type: "BREAK_FINISHED" });
  }
}