// background.js
import { loadSettings } from "./storage.js";

let settings = null;          // актуальные настройки
let elapsedMs = 0;            // сколько уже насчитано (мс)
let timerId = null;           // id setInterval
let isOnBreak = false;        // сейчас идёт перерыв с котом или нет

// === ИНИЦИАЛИЗАЦИЯ ===
init();

async function init() {
  settings = await loadSettings();
  setupStorageListener();
  setupRuntimeListener();
  setupActivityListeners();
  startCounting();
}

// Перезапуск таймера, когда меняются настройки / состояние
function restartCounting() {
  stopCounting();
  elapsedMs = 0;
  isOnBreak = false;
  startCounting();
}

// === ТАЙМЕР АКТИВНОСТИ ===
function startCounting() {
  if (!settings?.isEnabled || isOnBreak) return;

  const stepMs = 1000; // считаем раз в секунду

  timerId = setInterval(async () => {
    if (!settings.isEnabled || isOnBreak) return;

    const browserActive = await isBrowserActive();
    if (!browserActive) return;

    elapsedMs += stepMs;
    const limitMs = settings.limitMinutes * 60 * 1000;

    if (elapsedMs >= limitMs) {
      // Пора вызвать кота
      isOnBreak = true;
      stopCounting();
      triggerCatOverlayOnAllTabs();
      // дальше ждём сообщения от контент-скрипта о конце перерыва
    }
  }, stepMs);
}

function stopCounting() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

// Проверяем, есть ли активное окно и вкладка
function isBrowserActive() {
  return new Promise((resolve) => {
    chrome.windows.getLastFocused({ populate: true }, (win) => {
      if (!win || win.state === "minimized" || !win.focused) {
        resolve(false);
        return;
      }

      const activeTab = win.tabs.find((t) => t.active);
      resolve(!!activeTab);
    });
  });
}

// === ВЫЗОВ КОТА ===
// Рассылаем команду всем вкладкам (MVP: блокируем всё)
function triggerCatOverlayOnAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, { type: "SHOW_CAT_OVERLAY" });
    }
  });
}

// === ЛИСТЕНЕРЫ НАСТРОЕК И СООБЩЕНИЙ ===
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    let needRestart = false;

    if (changes.isEnabled) {
      settings.isEnabled = changes.isEnabled.newValue;
      needRestart = true;
    }
    if (changes.limitMinutes) {
      settings.limitMinutes = changes.limitMinutes.newValue;
      needRestart = true;
    }
    if (changes.breakMinutes) {
      settings.breakMinutes = changes.breakMinutes.newValue;
      // breakMinutes нужен контент-скрипту, тут можно не рестартить
    }

    if (needRestart) {
      restartCounting();
    }
  });
}

function setupRuntimeListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "BREAK_FINISHED") {
      // Перерыв закончился — начинаем новый цикл
      elapsedMs = 0;
      isOnBreak = false;
      startCounting();
      sendResponse({ ok: true });
    }
  });
}

// Можно подписаться на смену вкладок/окон, если захочешь
function setupActivityListeners() {
  chrome.tabs.onActivated.addListener(() => {
    // по факту нам достаточно isBrowserActive() в таймере,
    // но этот listener оставим на будущее (оптимизации/логика)
  });

  chrome.windows.onFocusChanged.addListener(() => {
    // аналогично, можно использовать для дополнительных проверок
  });
}