// options.js
import { loadSettings, saveSettings } from "./storage.js";

const isEnabledEl = document.getElementById("isEnabled");
const limitEl = document.getElementById("limitMinutes");
const breakEl = document.getElementById("breakMinutes");
const saveButton = document.getElementById("saveButton");
const statusEl = document.getElementById("status");

// Инициализация
init();

async function init() {
  const settings = await loadSettings();

  isEnabledEl.checked = settings.isEnabled;
  limitEl.value = settings.limitMinutes;
  breakEl.value = settings.breakMinutes;

  saveButton.addEventListener("click", onSave);
}

async function onSave() {
  const isEnabled = isEnabledEl.checked;
  const limitMinutes = Number(limitEl.value);
  const breakMinutes = Number(breakEl.value);

  // Простая валидация
  if (!Number.isFinite(limitMinutes) || limitMinutes <= 0) {
    showStatus("Enter a valid Limit in minutes.", true);
    return;
  }
  if (!Number.isFinite(breakMinutes) || breakMinutes <= 0) {
    showStatus("Enter a valid Break in minutes.", true);
    return;
  }

  await saveSettings({ isEnabled, limitMinutes, breakMinutes });
  showStatus("Saved ✅", false);
}

function showStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#d64545" : "#2f7c4c";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
}