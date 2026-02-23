const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const connectedUrlEl = document.getElementById("connected-url");
const pairInput = document.getElementById("pair-input");
const pairDisplay = document.getElementById("pair-display");
const serverUrlInput = document.getElementById("server-url");
const pairedHostText = document.getElementById("paired-host-text");
const btnPair = document.getElementById("btn-pair");
const btnUnpair = document.getElementById("btn-unpair");
const btnRetry = document.getElementById("btn-retry");

const STATUS_LABELS = {
  connected: "Connected",
  disconnected: "Disconnected",
};

function updateStatus(status, url) {
  statusEl.className = `status ${status}`;
  statusText.textContent = STATUS_LABELS[status] || status;
  connectedUrlEl.textContent = url || "";
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

// Load initial state
chrome.runtime.sendMessage({ type: "get_status" }, (res) => {
  if (res) updateStatus(res.status, res.url);
});

chrome.storage.local.get("serverUrl", ({ serverUrl }) => {
  showPairedUrl(serverUrl || null);
});

// Live status updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "status") {
    updateStatus(message.status, message.url);
  }
});

// Save server URL
btnPair.addEventListener("click", () => {
  const url = serverUrlInput.value.trim();
  if (!url) return;
  chrome.runtime.sendMessage({ type: "set_server_url", url });
  showPairedUrl(url);
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
  licenseStatus.textContent = text;
  licenseStatus.className = "hint" + (className ? " " + className : "");
}

// Load saved license state
chrome.storage.local.get(
  ["licenseKey", "licenseValid"],
  ({ licenseKey, licenseValid }) => {
    if (licenseKey) {
      showLicenseKey(licenseKey);
      if (licenseValid === true) {
        setLicenseStatus("License active", "valid");
      } else if (licenseValid === false) {
        setLicenseStatus("License invalid or expired", "invalid");
      }
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
        setLicenseStatus("License active", "valid");
      } else {
        setLicenseStatus(
          response?.error || "License validation failed",
          "invalid"
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
    setLicenseStatus("", "");
  });
});
