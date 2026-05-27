import { loadSettings, saveSettings } from "./storage.js";

window.addEventListener("load", () => {
  init().catch((error) => {
    console.error("Failed to initialize options page:", error);
  });
});

async function init() {
  const els = {
    isEnabled: document.getElementById("isEnabled"),
    limitMinutes: document.getElementById("limitMinutes"),
    breakMinutes: document.getElementById("breakMinutes"),
    saveButton: document.getElementById("saveButton"),
    testCatButton: document.getElementById("testCatButton"),
    status: document.getElementById("status")
  };

  if (
    !els.isEnabled ||
    !els.limitMinutes ||
    !els.breakMinutes ||
    !els.saveButton ||
    !els.status
  ) {
    console.error("Options UI is missing required elements", els);
    return;
  }

  const settings = await loadSettings();

  els.isEnabled.checked = Boolean(settings?.isEnabled);
  els.limitMinutes.value = String(settings?.limitMinutes ?? 60);
  els.breakMinutes.value = String(settings?.breakMinutes ?? 5);

  els.isEnabled.addEventListener("change", async () => {
    try {
      await saveSettings({
        isEnabled: els.isEnabled.checked
      });

      showStatus(
        els,
        els.isEnabled.checked ? "Nika enabled ✅" : "Nika disabled ✅",
        false
      );
    } catch (error) {
      console.error("Failed to update enabled state:", error);
      showStatus(els, "Could not update Nika state.", true);
    }
  });

  els.saveButton.addEventListener("click", async () => {
    await onSave(els);
  });

  /*
  if (els.testCatButton) {
    els.testCatButton.addEventListener("click", async () => {
      await onTestCat(els);
    });
  }
  */
}

async function onSave(els) {
  const isEnabled = els.isEnabled.checked;
  const limitMinutes = Number(els.limitMinutes.value);
  const breakMinutes = Number(els.breakMinutes.value);

  if (!Number.isFinite(limitMinutes) || limitMinutes <= 0) {
    showStatus(els, "Enter a valid Limit in minutes.", true);
    els.limitMinutes.focus();
    return false;
  }

  if (!Number.isFinite(breakMinutes) || breakMinutes <= 0) {
    showStatus(els, "Enter a valid Break in minutes.", true);
    els.breakMinutes.focus();
    return false;
  }

  await saveSettings({
    isEnabled,
    limitMinutes,
    breakMinutes
  });

  showStatus(els, "Saved ✅", false);
  return true;
}

/*
async function onTestCat(els) {
  try {
    const saved = await onSave(els);
    if (!saved) return;

    await chrome.runtime.sendMessage({ type: "SHOW_CAT_OVERLAY_TEST" });
    showStatus(els, "Test signal sent 🐾", false);
  } catch (error) {
    console.error(error);
    showStatus(els, "Could not trigger cat test.", true);
  }
}
*/

function showStatus(els, message, isError) {
  if (!els?.status) return;

  els.status.textContent = message;
  els.status.style.color = isError ? "#d64545" : "#2f7c4c";

  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    if (els.status && els.status.textContent === message) {
      els.status.textContent = "";
    }
  }, 2000);
}