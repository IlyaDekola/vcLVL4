// content-script.js

let overlayEl = null;
let countdownId = null;

// Слушаем команды от background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SHOW_CAT_OVERLAY") {
    showCatOverlay();
  }
});

// Получаем настройки, чтобы узнать breakMinutes
async function loadSettingsForContent() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["breakMinutes"],
      (data) => {
        const breakMinutes =
          typeof data.breakMinutes === "number" ? data.breakMinutes : 5;
        resolve({ breakMinutes });
      }
    );
  });
}

async function showCatOverlay() {
  if (overlayEl) return; // уже показан

  const { breakMinutes } = await loadSettingsForContent();
  const breakMs = breakMinutes * 60 * 1000;
  const endTime = Date.now() + breakMs;

  // === ОСНОВНОЙ ОВЕРЛЕЙ ===
  overlayEl = document.createElement("div");
  overlayEl.id = "my-cat-overlay";
  overlayEl.style.position = "fixed";
  overlayEl.style.inset = "0";
  overlayEl.style.zIndex = "2147483647"; // максимально высоко

  // МОЛОЧНЫЙ ФОН + БЛЮР + ЛЁГКОЕ ЗАТЕМНЕНИЕ
  // Цвет: тёплый бежево-молочный, поверх полупрозрачный слой.
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

  // Чтобы элементы не прилипали к самому краю
  overlayEl.style.padding = "24px";

  // === ТАЙМЕР-БЕЙДЖ В ЛЕВОМ ВЕРХНЕМ УГЛУ (как на примере) ===
  const badge = document.createElement("div");
  badge.style.position = "absolute";
  badge.style.top = "20px";
  badge.style.left = "20px";
  badge.style.padding = "10px 14px";
  badge.style.borderRadius = "12px";
  badge.style.background = "rgba(40, 30, 25, 0.9)";
  badge.style.color = "#fbeee6";
  badge.style.display = "flex";
  badge.style.flexDirection = "column";
  badge.style.alignItems = "flex-start";
  badge.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.25)";

  const badgeLabel = document.createElement("div");
  badgeLabel.textContent = "CAT ON DUTY";
  badgeLabel.style.fontSize = "10px";
  badgeLabel.style.letterSpacing = "0.14em";
  badgeLabel.style.textTransform = "uppercase";
  badgeLabel.style.opacity = "0.9";
  badgeLabel.style.marginBottom = "4px";

  const timerEl = document.createElement("div");
  timerEl.style.fontSize = "20px";
  timerEl.style.fontWeight = "600";
  timerEl.style.fontFeatureSettings = "'tnum' 1, 'lnum' 1";

  badge.appendChild(badgeLabel);
  badge.appendChild(timerEl);

  // === БЛОК С КОТОМ ВНИЗУ (примерно как на промо) ===
  const catWrapper = document.createElement("div");
  catWrapper.style.position = "absolute";
  catWrapper.style.bottom = "40px";
  catWrapper.style.right = "40px";
  catWrapper.style.display = "flex";
  catWrapper.style.alignItems = "flex-end";
  catWrapper.style.gap = "24px";

  const catImg = document.createElement("img");
  catImg.src = chrome.runtime.getURL("assets/cat-overlay.png");
  catImg.alt = "Cat gatekeeper";
  catImg.style.maxWidth = "360px";
  catImg.style.height = "auto";
  catImg.style.display = "block";
  catImg.style.filter = "drop-shadow(0 18px 35px rgba(0,0,0,0.35))";

  const textBlock = document.createElement("div");
  textBlock.style.maxWidth = "320px";
  textBlock.style.marginBottom = "16px";

  const title = document.createElement("div");
  title.textContent = "Ваш кот дежурит. Время отдохнуть от интернета.";
  title.style.fontSize = "20px";
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";

  const subtitle = document.createElement("div");
  subtitle.textContent =
    "Сделайте паузу, встаньте, потянитесь. Когда таймер дойдёт до нуля, кот снова пустит вас в сеть.";
  subtitle.style.fontSize = "14px";
  subtitle.style.lineHeight = "1.5";
  subtitle.style.opacity = "0.9";

  textBlock.appendChild(title);
  textBlock.appendChild(subtitle);

  catWrapper.appendChild(textBlock);
  catWrapper.appendChild(catImg);

  overlayEl.appendChild(badge);
  overlayEl.appendChild(catWrapper);

  document.documentElement.appendChild(overlayEl);

  // Опционально блокируем скролл (для строгого режима)
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  // === ЗАПУСК ТАЙМЕРА ===
  updateTimer(timerEl, endTime);
  countdownId = setInterval(() => {
    const stillRunning = updateTimer(timerEl, endTime);
    if (!stillRunning) {
      clearInterval(countdownId);
      countdownId = null;
      hideCatOverlay(prevOverflow);
    }
  }, 1000);
}

// Обновляет таймер, возвращает true если ещё идёт отсчёт
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

function hideCatOverlay(prevOverflow) {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  document.documentElement.style.overflow = prevOverflow || "";

  chrome.runtime.sendMessage({ type: "BREAK_FINISHED" });
}