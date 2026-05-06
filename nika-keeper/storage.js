// storage.js

const DEFAULT_SETTINGS = {
  isEnabled: true,
  limitMinutes: 60,
  breakMinutes: 5
};

// Получить настройки (с подстановкой дефолтов, если чего-то нет)
export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["isEnabled", "limitMinutes", "breakMinutes"],
      (data) => {
        const settings = {
          isEnabled:
            typeof data.isEnabled === "boolean"
              ? data.isEnabled
              : DEFAULT_SETTINGS.isEnabled,
          limitMinutes:
            typeof data.limitMinutes === "number"
              ? data.limitMinutes
              : DEFAULT_SETTINGS.limitMinutes,
          breakMinutes:
            typeof data.breakMinutes === "number"
              ? data.breakMinutes
              : DEFAULT_SETTINGS.breakMinutes
        };

        resolve(settings);
      }
    );
  });
}

// Частично сохранить настройки (обновляет только переданные поля)
export function saveSettings(partialSettings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(partialSettings, () => {
      resolve();
    });
  });
}