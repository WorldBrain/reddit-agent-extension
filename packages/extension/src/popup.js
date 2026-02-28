const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const connectedUrlEl = document.getElementById("connected-url");
const pairingInfoEl = document.getElementById("pairing-info");
const pairInput = document.getElementById("pair-input");
const pairDisplay = document.getElementById("pair-display");
const serverUrlInput = document.getElementById("server-url");
const pairedHostText = document.getElementById("paired-host-text");
const btnPair = document.getElementById("btn-pair");
const btnUnpair = document.getElementById("btn-unpair");
const btnRetry = document.getElementById("btn-retry");

const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));
const pairingPanel = document.getElementById("pairing-panel");
const licensePanel = document.getElementById("license-panel");

const STATUS_LABELS = {
  connected: "Connected",
  disconnected: "Disconnected",
  pairing: "Pairing Required",
};

function setActiveTab(activeTab) {
  tabButtons.forEach((tab) => {
    const isActive = tab.dataset.tab === activeTab;
    tab.classList.toggle("active", isActive);
  });

  if (pairingPanel) {
    pairingPanel.classList.toggle("active", activeTab === "pairing");
  }
  if (licensePanel) {
    licensePanel.classList.toggle("active", activeTab === "license");
  }
}

function initTabs() {
  tabButtons.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.tab);
    });
  });
  setActiveTab("pairing");
}

function updateStatus(status, url, pairingCode, pairingHelp, protocol) {
  statusEl.className = `status-panel ${status}`;
  statusText.textContent = STATUS_LABELS[status] || status;
  connectedUrlEl.textContent = url || "";

  if (status === "pairing" && (pairingCode || pairingHelp)) {
    pairingInfoEl.style.display = "block";
    if (protocol === "gateway") {
      if (pairingHelp) {
        pairingInfoEl.textContent = pairingHelp;
      } else {
        pairingInfoEl.textContent = `Approve with: openclaw devices approve ${pairingCode}`;
      }
    } else {
      if (pairingCode) {
        pairingInfoEl.textContent =
          `Pairing code: ${pairingCode}. Ask OpenClaw to approve this code.`;
      } else {
        pairingInfoEl.textContent = pairingHelp;
      }
    }
  } else if (status === "connected" && protocol === "gateway") {
    pairingInfoEl.style.display = "block";
    pairingInfoEl.textContent =
      "Connected via Gateway. Plugin tools require the bridge URL ws://<host>:7071/ws.";
  } else if (status === "disconnected" && pairingHelp) {
    pairingInfoEl.style.display = "block";
    pairingInfoEl.textContent = pairingHelp;
  } else {
    pairingInfoEl.style.display = "none";
    pairingInfoEl.textContent = "";
  }
}

function showPairedUrl(url) {
  if (url) {
    pairInput.style.display = "none";
    pairDisplay.style.display = "flex";
    pairedHostText.textContent = url;
  } else {
    pairInput.style.display = "flex";
    pairDisplay.style.display = "none";
    serverUrlInput.value = "";
  }
}

function normalizeServerUrl(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

  let parsed;
  try {
    parsed = hasScheme ? new URL(value) : new URL(`ws://${value}`);
  } catch {
    return null;
  }
  if (!parsed.hostname) return null;

  // Keep only the address in the host field; background builds protocol/port/path candidates.
  return parsed.hostname;
}

function normalizeServerInputField() {
  const normalized = normalizeServerUrl(serverUrlInput.value);
  if (normalized) {
    serverUrlInput.value = normalized;
  }
  return normalized;
}

// Load initial state
chrome.runtime.sendMessage({ type: "get_status" }, (res) => {
  if (res) {
    updateStatus(
      res.status,
      res.url,
      res.pairingCode,
      res.pairingHelp,
      res.protocol,
    );
  }
});

chrome.storage.local.get("serverUrl", ({ serverUrl }) => {
  showPairedUrl(serverUrl || null);
});

// Live status updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "status") {
    updateStatus(
      message.status,
      message.url,
      message.pairingCode,
      message.pairingHelp,
      message.protocol,
    );
  }
});

// Save server host
btnPair.addEventListener("click", () => {
  const normalized = normalizeServerInputField();
  if (!normalized) return;
  chrome.runtime.sendMessage(
    { type: "set_server_url", url: normalized },
    (response) => {
      if (response?.ok) {
        showPairedUrl(response.serverUrl || normalized);
      }
    },
  );
});

serverUrlInput.addEventListener("blur", () => {
  normalizeServerInputField();
});

serverUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    btnPair.click();
  }
});

// Remove server URL
btnUnpair.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "set_server_url", url: "" });
  showPairedUrl(null);
});

// Retry connection
btnRetry.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "retry" });
});

// Help / setup guide
document.getElementById("btn-help").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "open_install" });
});

// =============================================
// License Key Management
// =============================================

const licenseInput = document.getElementById("license-input");
const licenseDisplay = document.getElementById("license-display");
const licenseKeyInput = document.getElementById("license-key");
const licenseKeyText = document.getElementById("license-key-text");
const btnSaveLicense = document.getElementById("btn-save-license");
const btnRemoveLicense = document.getElementById("btn-remove-license");
const licenseStatus = document.getElementById("license-status");

function showLicenseKey(key) {
  if (key) {
    licenseInput.style.display = "none";
    licenseDisplay.style.display = "flex";
    licenseKeyText.textContent =
      key.length > 16 ? key.slice(0, 8) + "..." + key.slice(-4) : key;
  } else {
    licenseInput.style.display = "flex";
    licenseDisplay.style.display = "none";
    licenseKeyInput.value = "";
  }
}

function setLicenseStatus(text, className) {
  licenseStatus.textContent = "";
  licenseStatus.className = "hint" + (className ? " " + className : "");

  if (!text) {
    return;
  }

  const statusDot = document.createElement("span");
  statusDot.className = "license-status-dot";

  const statusText = document.createElement("span");
  statusText.className = "license-status-text";
  statusText.textContent = text;

  licenseStatus.appendChild(statusDot);
  licenseStatus.appendChild(statusText);
}

// Load saved license state
chrome.storage.local.get(
  ["licenseKey", "licenseValid"],
  ({ licenseKey, licenseValid }) => {
    if (licenseKey) {
      showLicenseKey(licenseKey);
      if (licenseValid === true) {
        setLicenseStatus("License active", "active");
      } else if (licenseValid === false) {
        setLicenseStatus("License invalid or expired", "error");
      }
    } else {
      setLicenseStatus("No license key", "inactive");
    }
  }
);

// Save license key
btnSaveLicense.addEventListener("click", () => {
  const key = licenseKeyInput.value.trim();
  if (!key) return;

  setLicenseStatus("Validating...", "checking");
  btnSaveLicense.disabled = true;

  chrome.runtime.sendMessage(
    { type: "validate_license", licenseKey: key },
    (response) => {
      btnSaveLicense.disabled = false;
      if (response && response.valid) {
        showLicenseKey(key);
        setLicenseStatus("License active", "active");
      } else {
        setLicenseStatus(
          response?.error || "License validation failed",
          "error"
        );
      }
    }
  );
});

// Remove license key
btnRemoveLicense.addEventListener("click", () => {
  setLicenseStatus("Deactivating...", "checking");
  btnRemoveLicense.disabled = true;
  chrome.runtime.sendMessage({ type: "remove_license" }, () => {
    btnRemoveLicense.disabled = false;
    showLicenseKey(null);
    setLicenseStatus("No license key", "inactive");
  });
});

initTabs();
