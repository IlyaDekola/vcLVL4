const DEFAULT_SETTINGS = {
  limitMinutes: 60,
  breakMinutes: 5,
  isEnabled: true
};

const DEFAULT_STATE = {
  elapsedMs: 0,
  lastTickAt: Date.now(),
  isOnBreak: false,
  breakEndsAt: null
};

console.log("background loaded");

chrome.runtime.onInstalled.addListener(async () => {
  console.log("onInstalled");
  await ensureDefaults();
  await ensureAlarm();
  await resetCycle();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("onStartup");
  await ensureDefaults();
  await ensureAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "nika-tick") return;
  await processTick();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (!changes.isEnabled) return;

  const newValue = changes.isEnabled.newValue;

  if (newValue === false) {
    void disableKeeperNow();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("runtime message", message);

  if (message?.type === "SHOW_CAT_OVERLAY_TEST") {
    void startBreakNow();
    sendResponse?.({ ok: true });
    return true;
  }

  if (message?.type === "BREAK_FINISHED") {
    void finishBreakIfExpired();
    sendResponse?.({ ok: true });
    return true;
  }

  if (message?.type === "GET_BREAK_STATE") {
    void (async () => {
      const settings = await getSettings();
      const state = await getState();

      sendResponse({
        isOnBreak: settings.isEnabled && !!state.isOnBreak,
        breakEndsAt: settings.isEnabled ? state.breakEndsAt || null : null
      });
    })();
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab?.id) return;
  if (!isInjectableUrl(tab.url)) return;

  void restoreOverlayIfNeeded(tab.id);
});

async function ensureDefaults() {
  const current = await chrome.storage.sync.get([
    "limitMinutes",
    "breakMinutes",
    "isEnabled"
  ]);

  const patch = {};
  if (typeof current.limitMinutes !== "number") {
    patch.limitMinutes = DEFAULT_SETTINGS.limitMinutes;
  }
  if (typeof current.breakMinutes !== "number") {
    patch.breakMinutes = DEFAULT_SETTINGS.breakMinutes;
  }
  if (typeof current.isEnabled !== "boolean") {
    patch.isEnabled = DEFAULT_SETTINGS.isEnabled;
  }

  if (Object.keys(patch).length) {
    await chrome.storage.sync.set(patch);
  }

  const local = await chrome.storage.local.get([
    "elapsedMs",
    "lastTickAt",
    "isOnBreak",
    "breakEndsAt"
  ]);

  const localPatch = {};
  if (typeof local.elapsedMs !== "number") {
    localPatch.elapsedMs = DEFAULT_STATE.elapsedMs;
  }
  if (typeof local.lastTickAt !== "number") {
    localPatch.lastTickAt = DEFAULT_STATE.lastTickAt;
  }
  if (typeof local.isOnBreak !== "boolean") {
    localPatch.isOnBreak = DEFAULT_STATE.isOnBreak;
  }
  if (!("breakEndsAt" in local)) {
    localPatch.breakEndsAt = DEFAULT_STATE.breakEndsAt;
  }

  if (Object.keys(localPatch).length) {
    await chrome.storage.local.set(localPatch);
  }
}

async function ensureAlarm() {
  const alarm = await chrome.alarms.get("nika-tick");
  if (!alarm) {
    await chrome.alarms.create("nika-tick", { periodInMinutes: 0.5 });
    console.log("alarm created");
  }
}

async function getSettings() {
  const data = await chrome.storage.sync.get([
    "limitMinutes",
    "breakMinutes",
    "isEnabled"
  ]);

  return {
    limitMinutes:
      typeof data.limitMinutes === "number"
        ? data.limitMinutes
        : DEFAULT_SETTINGS.limitMinutes,
    breakMinutes:
      typeof data.breakMinutes === "number"
        ? data.breakMinutes
        : DEFAULT_SETTINGS.breakMinutes,
    isEnabled:
      typeof data.isEnabled === "boolean"
        ? data.isEnabled
        : DEFAULT_SETTINGS.isEnabled
  };
}

async function getState() {
  const data = await chrome.storage.local.get([
    "elapsedMs",
    "lastTickAt",
    "isOnBreak",
    "breakEndsAt"
  ]);

  return {
    elapsedMs: typeof data.elapsedMs === "number" ? data.elapsedMs : 0,
    lastTickAt: typeof data.lastTickAt === "number" ? data.lastTickAt : Date.now(),
    isOnBreak: typeof data.isOnBreak === "boolean" ? data.isOnBreak : false,
    breakEndsAt: typeof data.breakEndsAt === "number" ? data.breakEndsAt : null
  };
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
}

async function resetCycle() {
  console.log("resetCycle");
  await setState({
    elapsedMs: 0,
    lastTickAt: Date.now(),
    isOnBreak: false,
    breakEndsAt: null
  });
}

async function disableKeeperNow() {
  await resetCycle();
  await notifyAllTabsHideOverlay();
}

async function processTick() {
  const settings = await getSettings();
  const state = await getState();

  console.log("processTick", { settings, state });

  if (!settings.isEnabled) {
    await resetCycle();
    await notifyAllTabsHideOverlay();
    return;
  }

  if (state.isOnBreak) {
    if (state.breakEndsAt && Date.now() < state.breakEndsAt) {
      return;
    }

    await finishBreak();
    return;
  }

  const now = Date.now();
  const delta = Math.max(0, now - state.lastTickAt);
  const nextElapsedMs = state.elapsedMs + delta;
  const limitMs = settings.limitMinutes * 60 * 1000;

  if (nextElapsedMs >= limitMs) {
    await startBreakNow();
    return;
  }

  await setState({
    elapsedMs: nextElapsedMs,
    lastTickAt: now
  });
}

async function startBreakNow() {
  const settings = await getSettings();
  if (!settings.isEnabled) return;

  const state = await getState();
  if (state.isOnBreak) return;

  const breakEndsAt = Date.now() + settings.breakMinutes * 60 * 1000;

  await setState({
    isOnBreak: true,
    breakEndsAt,
    elapsedMs: 0,
    lastTickAt: Date.now()
  });

  await triggerCatOverlayOnAllTabs(breakEndsAt);
}

async function finishBreak() {
  await setState({
    elapsedMs: 0,
    lastTickAt: Date.now(),
    isOnBreak: false,
    breakEndsAt: null
  });

  await notifyAllTabsHideOverlay();
}

async function finishBreakIfExpired() {
  const state = await getState();
  if (!state.isOnBreak) return;

  if (state.breakEndsAt && Date.now() < state.breakEndsAt) {
    return;
  }

  await finishBreak();
}

async function triggerCatOverlayOnAllTabs(breakEndsAt) {
  const settings = await getSettings();
  if (!settings.isEnabled) return;

  const tabs = await chrome.tabs.query({});
  console.log("triggerCatOverlayOnAllTabs", tabs.length);

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || !isInjectableUrl(tab.url)) return;

      try {
        await ensureContentScriptInjected(tab.id);
        await chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_CAT_OVERLAY",
          breakEndsAt
        });
      } catch (error) {
        console.warn("sendMessage failed for tab", tab.id, error?.message || error);
      }
    })
  );
}

async function notifyAllTabsHideOverlay() {
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || !isInjectableUrl(tab.url)) return;

      try {
        await ensureContentScriptInjected(tab.id);
        await chrome.tabs.sendMessage(tab.id, {
          type: "HIDE_CAT_OVERLAY"
        });
      } catch (error) {
        console.warn("hide overlay failed for tab", tab.id, error?.message || error);
      }
    })
  );
}

async function restoreOverlayIfNeeded(tabId) {
  const settings = await getSettings();
  if (!settings.isEnabled) return;

  const state = await getState();

  if (!state.isOnBreak) return;
  if (!state.breakEndsAt) return;

  if (Date.now() >= state.breakEndsAt) {
    await finishBreak();
    return;
  }

  try {
    await ensureContentScriptInjected(tabId);
    await chrome.tabs.sendMessage(tabId, {
      type: "SHOW_CAT_OVERLAY",
      breakEndsAt: state.breakEndsAt
    });
  } catch (error) {
    console.warn("restore overlay failed for tab", tabId, error?.message || error);
  }
}

async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT_SCRIPT" });
    return;
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"]
    });
  }
}

function isInjectableUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http://") || url.startsWith("https://");
}