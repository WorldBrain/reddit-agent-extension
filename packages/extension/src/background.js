import API_DOCS from "../API.md?raw";
import {
  validateLicenseCached,
  invalidateLicenseCache,
  activateLicense,
  deactivateLicense,
  WEBSITE_URL,
} from "reddit-agent-common";

// =============================================
// Connection State
// =============================================

let ws = null;
let connectionStatus = "disconnected"; // 'connected' | 'disconnected'
let connectedUrl = null;
let isConnecting = false;
let reconnectTimer = null;
let keepAliveIntervalId = null;

// Worker Window for background commenting
let workerWindowId = null;
let workerWindowPromise = null;
let activePostCount = 0;

function setStatus(status, url) {
  connectionStatus = status;
  connectedUrl = url || null;
  console.log(`[RedditAgent] Status: ${status}${url ? ` (${url})` : ""}`);
  chrome.runtime.sendMessage({ type: "status", status, url }).catch(() => {});
}

// =============================================
// Connection Management
// =============================================

function tryWebSocket(url, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);

    const socket = new WebSocket(url);

    socket.onopen = () => {
      clearTimeout(timer);
      resolve(socket);
    };

    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Connection failed"));
    };
  });
}

function forceReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
  isConnecting = false;
  if (ws) {
    ws.onclose = null; // prevent onclose from scheduling another reconnect
    ws.close();
    ws = null;
  }
  setStatus("disconnected");
  connectToServer();
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToServer();
  }, 5000);
}

async function connectToServer() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (isConnecting) return;

  isConnecting = true;

  // Cancel any pending reconnect since we're connecting now
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const { serverUrl } = await chrome.storage.local.get("serverUrl");
  if (!serverUrl) {
    console.log("[RedditAgent] No server URL configured");
    setStatus("disconnected");
    isConnecting = false;
    return;
  }

  console.log(`[RedditAgent] Connecting to ${serverUrl}...`);
  try {
    const socket = await tryWebSocket(serverUrl, 3000);
    isConnecting = false;
    setupSocket(socket, serverUrl);
  } catch {
    console.log(`[RedditAgent] Server not available`);
    setStatus("disconnected");
    isConnecting = false;
    scheduleReconnect();
  }
}

function setupSocket(socket, url) {
  ws = socket;
  setStatus("connected", url);

  // Identify this connection as the extension (not a tool-handler)
  ws.send(JSON.stringify({ type: "identify", role: "extension" }));

  ws.onmessage = async (event) => {
    let message;
    try {
      const raw =
        typeof event.data === "string" ? event.data : await event.data.text();
      message = JSON.parse(raw);
    } catch (err) {
      console.error("[RedditAgent] Failed to parse message:", err, event.data);
      return;
    }

    if (message.type === "pong") return;

    console.log(
      "[RedditAgent] Received:",
      message.action,
      message.id,
      JSON.stringify(message.params),
    );

    try {
      const result = await handleAction(message.action, message.params);
      const preview = Array.isArray(result)
        ? `Array(${result.length})`
        : typeof result === "object"
          ? Object.keys(result).join(",")
          : String(result);
      console.log(
        "[RedditAgent] Success:",
        message.action,
        message.id,
        "| result:",
        preview,
      );
      const payload = JSON.stringify({
        id: message.id,
        success: true,
        data: result,
      });
      console.log("[RedditAgent] Sending response:", payload.length, "bytes");
      ws.send(payload);
    } catch (err) {
      console.error(
        "[RedditAgent] Error:",
        message.action,
        err.message,
        err.stack,
      );
      ws.send(
        JSON.stringify({ id: message.id, success: false, error: err.message }),
      );
    }
  };

  ws.onclose = () => {
    ws = null;
    console.log(`[RedditAgent] Connection closed`);
    setStatus("disconnected");
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };

  startKeepAlive();
}

function startKeepAlive() {
  // Clear any previous keepAlive interval to prevent leaks
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId);
  }
  keepAliveIntervalId = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    } else {
      clearInterval(keepAliveIntervalId);
      keepAliveIntervalId = null;
    }
  }, 20000);
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get_status") {
    sendResponse({ status: connectionStatus, url: connectedUrl });
    return;
  }
  if (message.type === "set_server_url") {
    const url = message.url?.trim();
    if (!url) {
      chrome.storage.local.remove("serverUrl");
    } else {
      chrome.storage.local.set({ serverUrl: url });
    }
    // Force reconnect with new URL
    forceReconnect();
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "retry") {
    forceReconnect();
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "open_install") {
    chrome.tabs.create({ url: `${WEBSITE_URL}/install` });
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "validate_license") {
    const key = message.licenseKey?.trim();
    if (!key) {
      sendResponse({ valid: false, error: "No license key provided" });
      return true;
    }
    validateLicenseCached(key, undefined, true)
      .then(async (result) => {
        if (result.valid) {
          // Activate to register this instance and track usage
          const activation = await activateLicense(
            key,
            "reddit-agent-extension",
          );
          if (activation.activated && activation.instanceId) {
            chrome.storage.local.set({
              licenseKey: key,
              licenseValid: true,
              licenseInstanceId: activation.instanceId,
            });
          } else {
            chrome.storage.local.set({ licenseKey: key, licenseValid: true });
          }
          sendResponse({ valid: true });
        } else {
          chrome.storage.local.set({ licenseKey: key, licenseValid: false });
          sendResponse({ valid: false, error: result.error });
        }
      })
      .catch((err) => {
        sendResponse({ valid: false, error: err.message });
      });
    return true; // keep message channel open for async response
  }
  if (message.type === "remove_license") {
    chrome.storage.local.get(
      ["licenseKey", "licenseInstanceId"],
      async ({ licenseKey, licenseInstanceId }) => {
        // Deactivate the instance with LemonSqueezy so it can be reactivated
        if (licenseKey && licenseInstanceId) {
          await deactivateLicense(licenseKey, licenseInstanceId);
        }
        chrome.storage.local.remove([
          "licenseKey",
          "licenseValid",
          "licenseInstanceId",
        ]);
        invalidateLicenseCache();
        sendResponse({ ok: true });
      },
    );
    return true; // keep message channel open for async response
  }
});

// Open the install page on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: `${WEBSITE_URL}/install` });
  }
});

// Start — only one call needed; onStartup/onInstalled re-run the service worker
// which already calls connectToServer() at the top level.
connectToServer();

// =============================================
// Action Dispatcher
// =============================================

async function handleAction(action, params) {
  console.log(`[RedditAgent] handleAction: ${action}`, params);

  // get_skill is the discovery endpoint — no license required
  if (action === "get_skill") {
    return getSkill();
  }

  // All other actions require a valid license
  const { licenseKey } = await chrome.storage.local.get("licenseKey");
  if (!licenseKey) {
    throw new Error(
      "No license key configured. Please add your license key in the extension popup.",
    );
  }

  const validation = await validateLicenseCached(licenseKey);
  if (!validation.valid) {
    chrome.storage.local.set({ licenseValid: false });
    throw new Error(
      "License expired or invalid. Please renew your subscription.",
    );
  }
  chrome.storage.local.set({ licenseValid: true });

  switch (action) {
    case "fetch_subreddit":
      return await fetchRedditJSON(params.url || params.subreddit, params.sort);
    case "search_reddit":
      return await searchReddit(
        params.query,
        params.sort,
        params.time,
        params.subreddit || params.url,
      );
    case "fetch_user_posts":
      return await fetchUserPosts(params.username, params.sort, params.time);
    case "fetch_post":
      return await fetchRedditJSON(params.url);
    case "reply_to_comment":
      return await replyToComment(params.commentUrl, params.replyText);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// =============================================
// Action — Skill
// =============================================

function getSkill() {
  return API_DOCS;
}

// =============================================
// Actions A & C — Fetch Subreddit/Post JSON
// =============================================

// Normalize shorthand subreddit references to full URLs:
//   "supplements"       -> "https://www.reddit.com/r/supplements"
//   "r/supplements"     -> "https://www.reddit.com/r/supplements"
//   "/r/supplements"    -> "https://www.reddit.com/r/supplements"
//   Full URLs pass through unchanged.
function normalizeSubredditUrl(input) {
  let normalized = input.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^\/+/, "");
    if (!/^r\//i.test(normalized)) {
      normalized = `r/${normalized}`;
    }
    normalized = `https://www.reddit.com/${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

async function fetchRedditJSON(url, sort) {
  if (!url) throw new Error("Missing required parameter: url");
  const VALID_SORTS = ["hot", "new", "top", "rising", "best"];
  let normalized = normalizeSubredditUrl(url);

  // If a sort is specified and the URL doesn't already include it, append it
  // e.g. https://www.reddit.com/r/workout -> https://www.reddit.com/r/workout/hot
  if (sort && VALID_SORTS.includes(sort.toLowerCase())) {
    const sortLower = sort.toLowerCase();
    // Only append if the URL doesn't already end with a sort segment or .json
    if (
      !normalized.includes(".json") &&
      !VALID_SORTS.some((s) => normalized.endsWith(`/${s}`))
    ) {
      normalized = `${normalized}/${sortLower}`;
    }
  }

  const jsonUrl = normalized.includes(".json")
    ? normalized
    : normalized + ".json";
  console.log(`[RedditAgent] fetchRedditJSON: ${jsonUrl}`);

  const response = await fetch(jsonUrl, {
    headers: { "User-Agent": "RedditAgentExtension/1.0" },
  });

  console.log(
    `[RedditAgent] fetchRedditJSON response: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    throw new Error(
      `Reddit API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log(
    `[RedditAgent] fetchRedditJSON parsed: ${Array.isArray(data) ? `Array(${data.length})` : typeof data}`,
  );
  return data;
}

// =============================================
// Action B — Search Reddit and Extract Posts
// =============================================

function filterPost(child) {
  const d = child.data;
  return {
    kind: child.kind,
    data: {
      // Identification
      id: d.id,
      name: d.name,
      author: d.author,
      author_fullname: d.author_fullname,

      // Subreddit
      subreddit: d.subreddit,
      subreddit_name_prefixed: d.subreddit_name_prefixed,
      subreddit_id: d.subreddit_id,
      subreddit_subscribers: d.subreddit_subscribers,

      // Content
      title: d.title,
      selftext: d.selftext,
      url: d.url,
      domain: d.domain,
      permalink: d.permalink,
      is_self: d.is_self,
      post_hint: d.post_hint,
      is_video: d.is_video,

      // Engagement
      score: d.score,
      ups: d.ups,
      downs: d.downs,
      upvote_ratio: d.upvote_ratio,
      num_comments: d.num_comments,
      num_crossposts: d.num_crossposts,

      // Timestamps
      created_utc: d.created_utc,

      // Flags
      over_18: d.over_18,
      spoiler: d.spoiler,
      locked: d.locked,
      stickied: d.stickied,
      archived: d.archived,
      pinned: d.pinned,
      is_original_content: d.is_original_content,

      // Media — video posts
      media: d.media
        ? {
            reddit_video: d.media.reddit_video
              ? {
                  fallback_url: d.media.reddit_video.fallback_url,
                  dash_url: d.media.reddit_video.dash_url,
                  hls_url: d.media.reddit_video.hls_url,
                  scrubber_media_url: d.media.reddit_video.scrubber_media_url,
                  width: d.media.reddit_video.width,
                  height: d.media.reddit_video.height,
                  duration: d.media.reddit_video.duration,
                  bitrate_kbps: d.media.reddit_video.bitrate_kbps,
                  has_audio: d.media.reddit_video.has_audio,
                  is_gif: d.media.reddit_video.is_gif,
                  transcoding_status: d.media.reddit_video.transcoding_status,
                }
              : undefined,
          }
        : null,

      // Media — thumbnails & image preview
      thumbnail: d.thumbnail,
      thumbnail_height: d.thumbnail_height,
      thumbnail_width: d.thumbnail_width,
      preview: d.preview
        ? {
            images: d.preview.images?.map((img) => ({
              source: img.source,
            })),
          }
        : undefined,

      // Flair
      author_flair_text: d.author_flair_text,
      link_flair_text: d.link_flair_text,
    },
  };
}

async function searchReddit(query, sort, time, subreddit) {
  if (!query) throw new Error("Missing required parameter: query");
  const VALID_SORTS = ["relevance", "top", "new", "comments"];
  const VALID_TIMES = ["hour", "day", "week", "month", "year"];

  // If a subreddit is provided, search within it; otherwise search all of Reddit
  let searchUrl;
  if (subreddit) {
    const base = normalizeSubredditUrl(subreddit);
    searchUrl = `${base}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1`;
  } else {
    searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}`;
  }
  if (sort && VALID_SORTS.includes(sort.toLowerCase())) {
    searchUrl += `&sort=${sort.toLowerCase()}`;
  }
  if (time && VALID_TIMES.includes(time.toLowerCase())) {
    searchUrl += `&t=${time.toLowerCase()}`;
  }
  console.log(
    `[RedditAgent] searchReddit: query="${query}" sort="${sort || "default"}" time="${time || "all"}" url=${searchUrl}`,
  );

  const response = await fetch(searchUrl, {
    headers: { "User-Agent": "RedditAgentExtension/1.0" },
  });

  console.log(
    `[RedditAgent] searchReddit response: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    throw new Error(
      `Reddit search API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log(
    `[RedditAgent] searchReddit: got ${data?.data?.children?.length || 0} results`,
  );

  return {
    kind: data.kind,
    data: {
      after: data.data?.after,
      before: data.data?.before,
      children: (data.data?.children || []).map(filterPost),
    },
  };
}

// =============================================
// Action E — Fetch User Posts
// =============================================

async function fetchUserPosts(username, sort, time) {
  if (!username) throw new Error("Missing required parameter: username");
  const VALID_SORTS = ["hot", "new", "top", "controversial"];
  const VALID_TIMES = ["hour", "day", "week", "month", "year"];

  // Strip u/ or /u/ prefix if provided
  let cleaned = username.trim().replace(/^\/?(u\/)/i, "");

  // Build URL: https://www.reddit.com/user/<username>/submitted.json
  let userUrl = `https://www.reddit.com/user/${encodeURIComponent(cleaned)}/submitted`;

  // Append sort to path (same pattern as subreddit listings)
  if (sort && VALID_SORTS.includes(sort.toLowerCase())) {
    userUrl += `/${sort.toLowerCase()}`;
  }

  userUrl += ".json";

  // Append time filter as query parameter
  if (time && VALID_TIMES.includes(time.toLowerCase())) {
    userUrl += `?t=${time.toLowerCase()}`;
  }

  console.log(
    `[RedditAgent] fetchUserPosts: username="${cleaned}" sort="${sort || "default"}" time="${time || "all"}" url=${userUrl}`,
  );

  const response = await fetch(userUrl, {
    headers: { "User-Agent": "RedditAgentExtension/1.0" },
  });

  console.log(
    `[RedditAgent] fetchUserPosts response: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    throw new Error(
      `Reddit user API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log(
    `[RedditAgent] fetchUserPosts: got ${data?.data?.children?.length || 0} posts`,
  );

  return {
    kind: data.kind,
    data: {
      after: data.data?.after,
      before: data.data?.before,
      children: (data.data?.children || []).map(filterPost),
    },
  };
}

// =============================================
// Action D — Reply to a Comment
// =============================================

function isSubComment(url) {
  // Sub-comments have "/comment/<id>" in the path
  // e.g. https://www.reddit.com/r/workout/comments/1oohnh6/comment/nn53chl
  // Top-level posts don't:
  // e.g. https://www.reddit.com/r/workout/comments/1oohnh6/
  return /\/comment\/\w+/.test(url);
}

async function replyToComment(commentUrl, replyText) {
  if (!commentUrl) throw new Error("Missing required parameter: commentUrl");
  if (!replyText) throw new Error("Missing required parameter: replyText");
  const windowId = await getWorkerWindow();
  activePostCount++;

  try {
    const tab = await createTabAndWaitForLoad(commentUrl, windowId);

    await sleep(3000);

    if (isSubComment(commentUrl)) {
      // --- Sub-comment reply: click Reply button, then type in composer ---
      let clickSuccess = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const clickResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: clickReplyButton,
          args: [commentUrl],
        });

        if (clickResult[0].result?.success) {
          clickSuccess = true;
          break;
        }

        console.log(
          `[RedditAgent] Reply button attempt ${attempt + 1} failed, retrying...`,
        );
        await sleep(2000);
      }

      if (!clickSuccess) {
        throw new Error("Failed to click Reply button after 3 attempts");
      }

      // Type the reply (with retry — composer may take time to mount)
      let typeResult;
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(2000);

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: typeAndSubmitReply,
          args: [replyText],
        });
        typeResult = results[0].result;

        if (typeResult?.success) {
          break;
        }

        console.log(
          `[RedditAgent] Type attempt ${attempt + 1} failed: ${typeResult?.error}`,
        );
      }

      if (!typeResult?.success) {
        throw new Error(
          typeResult?.error || "Failed to type reply after 5 attempts",
        );
      }
    } else {
      // --- Top-level post comment ---
      // Step 1: Click the composer to activate it (editor mounts on click)
      const activateResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: activateTopLevelComposer,
      });
      const activateResult = activateResults[0].result;
      console.log(
        "[RedditAgent] activateTopLevelComposer result:",
        JSON.stringify(activateResult),
      );

      // Step 2: Wait for editor to mount, then type
      let typeResult;
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(2000);

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: typeTopLevelComment,
          args: [replyText],
        });
        typeResult = results[0].result;
        console.log(
          `[RedditAgent] typeTopLevelComment attempt ${attempt + 1} result:`,
          JSON.stringify(typeResult),
        );

        if (typeResult?.success) {
          break;
        }

        console.log(
          `[RedditAgent] Top-level comment attempt ${attempt + 1} failed: ${typeResult?.error}`,
        );
      }

      if (!typeResult?.success) {
        throw new Error(
          typeResult?.error ||
            "Failed to type top-level comment after 5 attempts",
        );
      }
    }

    // Click the Comment/Reply button to submit (with retry)
    await sleep(500);
    let submitSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const submitResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: submitComment,
      });
      const result = submitResult[0].result;
      console.log(
        `[RedditAgent] submitComment attempt ${attempt + 1} result:`,
        JSON.stringify(result),
      );

      if (result?.success) {
        submitSuccess = true;
        break;
      }

      console.log(
        `[RedditAgent] Submit attempt ${attempt + 1} failed: ${result?.error}`,
      );
      await sleep(1000);
    }

    if (!submitSuccess) {
      throw new Error(
        "Failed to submit comment: could not find or click submit button",
      );
    }

    // Verify the comment was actually posted
    const replySubstring = replyText.substring(0, 50);
    let verified = false;
    let lastVerifyResult = null;

    for (let poll = 0; poll < 8; poll++) {
      await sleep(1500);

      const verifyResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: verifyCommentPosted,
        args: [replySubstring],
      });
      lastVerifyResult = verifyResults[0].result;

      console.log(
        `[RedditAgent] Verify poll ${poll + 1}: ${lastVerifyResult?.status}`,
      );

      if (
        lastVerifyResult?.status === "confirmed" ||
        lastVerifyResult?.status === "likely_success"
      ) {
        verified = true;
        break;
      }

      if (lastVerifyResult?.status === "error") {
        throw new Error(
          lastVerifyResult.error || "Reddit reported an error after submission",
        );
      }
    }

    if (!verified) {
      throw new Error(
        `Comment submission could not be verified after 12s. Last status: ${JSON.stringify(lastVerifyResult)}`,
      );
    }

    return {
      success: true,
      message: "Reply posted and verified",
      tabId: tab.id,
    };
  } finally {
    activePostCount--;
    if (activePostCount === 0 && workerWindowId !== null) {
      const toClose = workerWindowId;
      workerWindowId = null;
      workerWindowPromise = null;
      chrome.windows.remove(toClose).catch(() => {});
    }
  }
}

function activateTopLevelComposer() {
  try {
    const host = document.querySelector("comment-composer-host");
    if (!host) {
      return { success: false, error: "comment-composer-host not found" };
    }

    const input = host.querySelector("faceplate-textarea-input");
    if (!input) {
      return {
        success: false,
        error:
          "faceplate-textarea-input not found inside comment-composer-host",
      };
    }

    const label = input.shadowRoot?.querySelector("label");
    if (!label) {
      return {
        success: false,
        error: "label not found in faceplate-textarea-input shadow root",
      };
    }

    // Simulate a full user click to activate the editor
    label.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true }),
    );
    label.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, composed: true }),
    );
    label.focus();
    label.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, composed: true }),
    );
    label.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, composed: true }),
    );
    label.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    label.dispatchEvent(
      new FocusEvent("focusin", { bubbles: true, composed: true }),
    );

    return {
      success: true,
      activated:
        "comment-composer-host > faceplate-textarea-input > shadow > label",
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function clickReplyButton(commentUrl) {
  try {
    const urlObj = new URL(commentUrl);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const commentId = pathParts[pathParts.length - 1];

    const actionRows = document.querySelectorAll("shreddit-comment-action-row");

    let targetRow = null;
    for (const row of actionRows) {
      const permalink = row.getAttribute("permalink") || "";
      if (permalink.includes(commentId)) {
        targetRow = row;
        break;
      }
    }

    if (!targetRow) {
      const firstRow = document.querySelector("shreddit-comment-action-row");
      if (!firstRow) {
        return { success: false, error: "No comment action row found on page" };
      }
      targetRow = firstRow;
    }

    const roots = [targetRow.shadowRoot, targetRow].filter(Boolean);

    for (const root of roots) {
      const replyBtn =
        root.querySelector('button[data-testid="comment-reply-button"]') ||
        root.querySelector('button[aria-label="Reply"]');

      if (replyBtn) {
        replyBtn.click();
        return { success: true };
      }

      const allButtons = root.querySelectorAll("button");
      for (const btn of allButtons) {
        if (btn.textContent?.trim().toLowerCase() === "reply") {
          btn.click();
          return { success: true };
        }
      }
    }

    return { success: false, error: "Reply button not found" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function submitComment() {
  try {
    // Deep shadow DOM traversal
    function deepQuerySelectorAll(root, selector) {
      const results = [...root.querySelectorAll(selector)];
      const allElements = root.querySelectorAll("*");
      for (const el of allElements) {
        if (el.shadowRoot) {
          results.push(...deepQuerySelectorAll(el.shadowRoot, selector));
        }
      }
      return results;
    }

    // Strategy 1: Find button by type="submit" (most specific)
    const allButtons = deepQuerySelectorAll(document, "button");
    let submitBtn = allButtons.find(
      (btn) => btn.type === "submit" && btn.getBoundingClientRect().width > 0,
    );

    // Strategy 2: Find visible button with text "Comment" or "Reply"
    if (!submitBtn) {
      const submitTexts = ["comment", "reply"];
      submitBtn = allButtons.find((btn) => {
        const text = btn.textContent?.trim().toLowerCase();
        return (
          btn.getBoundingClientRect().width > 0 && submitTexts.includes(text)
        );
      });
    }

    // Strategy 3: Search inside comment-composer-host specifically
    if (!submitBtn) {
      const hosts = deepQuerySelectorAll(document, "comment-composer-host");
      for (const host of hosts) {
        const hostButtons = deepQuerySelectorAll(host, "button");
        const candidate = hostButtons.find((btn) => {
          const text = btn.textContent?.trim().toLowerCase();
          return (
            btn.getBoundingClientRect().width > 0 &&
            (btn.type === "submit" || text === "comment" || text === "reply")
          );
        });
        if (candidate) {
          submitBtn = candidate;
          break;
        }
      }
    }

    if (!submitBtn) {
      // Collect diagnostic info for debugging
      const visibleButtons = allButtons.filter(
        (b) => b.getBoundingClientRect().width > 0,
      );
      const buttonTexts = visibleButtons
        .map(
          (b) => `"${b.textContent?.trim().substring(0, 30)}" type=${b.type}`,
        )
        .join(", ");

      console.error(
        "[RedditAgent:page] submitComment: no submit button found.",
        `${visibleButtons.length} visible buttons: [${buttonTexts}]`,
      );
      return {
        success: false,
        error: `No Comment or Reply button found. ${visibleButtons.length} visible buttons: [${buttonTexts}]`,
      };
    }

    console.log(
      "[RedditAgent:page] submitComment: clicking button:",
      submitBtn.textContent?.trim(),
      "type=" + submitBtn.type,
    );
    submitBtn.click();
    return {
      success: true,
      method: "submit-button",
      buttonText: submitBtn.textContent?.trim(),
    };
  } catch (err) {
    console.error(
      "[RedditAgent:page] submitComment error:",
      err.message,
      err.stack,
    );
    return { success: false, error: err.message };
  }
}

function verifyCommentPosted(replyTextSubstring) {
  try {
    // Deep shadow DOM traversal
    function deepQuerySelectorAll(root, selector) {
      const results = [...root.querySelectorAll(selector)];
      const allElements = root.querySelectorAll("*");
      for (const el of allElements) {
        if (el.shadowRoot) {
          results.push(...deepQuerySelectorAll(el.shadowRoot, selector));
        }
      }
      return results;
    }

    // Signal 1: Check for error toasts (fast-exit on failure)
    const toasts = [
      ...deepQuerySelectorAll(document, '[role="alert"]'),
      ...deepQuerySelectorAll(document, "faceplate-toast"),
    ];
    const errorToast = toasts.find((el) => {
      const text = el.textContent?.toLowerCase() || "";
      return (
        text.includes("error") ||
        text.includes("wrong") ||
        text.includes("too much") ||
        text.includes("try again") ||
        text.includes("failed")
      );
    });

    if (errorToast) {
      return {
        status: "error",
        error: `Reddit error: ${errorToast.textContent?.trim().substring(0, 200)}`,
      };
    }

    // Signal 2: Check if composer textarea has been cleared or removed
    const textareas = deepQuerySelectorAll(document, "textarea");
    const activeTextarea = textareas.find(
      (ta) =>
        ta.getBoundingClientRect().width > 0 &&
        ta.getBoundingClientRect().height > 0,
    );
    const composerCleared =
      !activeTextarea || activeTextarea.value?.trim() === "";

    // Signal 3: Check if our reply text appears in the comment thread
    const allComments = deepQuerySelectorAll(document, "shreddit-comment");
    let foundOurComment = false;
    for (const comment of allComments) {
      const commentText = comment.textContent || "";
      if (commentText.includes(replyTextSubstring)) {
        foundOurComment = true;
        break;
      }
    }

    if (foundOurComment) {
      return { status: "confirmed", signal: "comment_found_in_thread" };
    }

    if (composerCleared) {
      return { status: "likely_success", signal: "composer_cleared" };
    }

    return {
      status: "pending",
      composerCleared,
      foundOurComment,
      activeTextareaValue: activeTextarea?.value?.substring(0, 50) || null,
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

function typeTopLevelComment(replyText) {
  try {
    const host = document.querySelector("comment-composer-host");
    if (!host) {
      return { success: false, error: "comment-composer-host not found" };
    }

    const input = host.querySelector("faceplate-textarea-input");
    if (!input) {
      return { success: false, error: "faceplate-textarea-input not found" };
    }

    // After activation, the textarea should be inside the shadow root
    const textarea = input.shadowRoot?.querySelector("textarea");
    if (!textarea) {
      return {
        success: false,
        error:
          "textarea not found in faceplate-textarea-input shadow root (editor may not be activated yet)",
      };
    }

    textarea.focus();

    // Clear any existing text, then use execCommand to insert — this triggers framework listeners
    textarea.select();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, replyText);

    console.log(
      "[RedditAgent:page] typeTopLevelComment: textarea.value =",
      JSON.stringify(textarea.value?.substring(0, 80)),
    );
    return {
      success: true,
      message: "Text entered",
      valueLength: textarea.value?.length,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function typeAndSubmitReply(replyText) {
  try {
    // Deep shadow DOM traversal — searches through ALL nested shadow roots
    function deepQuerySelectorAll(root, selector) {
      const results = [...root.querySelectorAll(selector)];
      const allElements = root.querySelectorAll("*");
      for (const el of allElements) {
        if (el.shadowRoot) {
          results.push(...deepQuerySelectorAll(el.shadowRoot, selector));
        }
      }
      return results;
    }

    // 1. Find faceplate-textarea-input — it IS the text input field
    const allInputs = deepQuerySelectorAll(
      document,
      "faceplate-textarea-input",
    );
    const inputField = allInputs.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (!inputField) {
      return {
        success: false,
        error: `Input field not found. faceplate-textarea-input count: ${allInputs.length}`,
      };
    }

    inputField.focus();
    inputField.click();

    if (typeof inputField.value !== "undefined") {
      inputField.value = replyText;
      inputField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    document.execCommand("insertText", false, replyText);

    return {
      success: true,
      message: `Text entered into <${inputField.tagName}>`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// =============================================
// Utilities
// =============================================

async function getWorkerWindow() {
  if (workerWindowId !== null) {
    try {
      await chrome.windows.get(workerWindowId);
      return workerWindowId;
    } catch (e) {
      workerWindowId = null;
      workerWindowPromise = null;
    }
  }

  if (workerWindowPromise) return workerWindowPromise;

  workerWindowPromise = (async () => {
    try {
      console.log("[RedditAgent] Creating worker window...");
      const window = await chrome.windows.create({
        focused: false,
        type: "normal",
      });
      workerWindowId = window.id;
      return workerWindowId;
    } catch (err) {
      workerWindowPromise = null;
      throw err;
    }
  })();

  return workerWindowPromise;
}

function createTabAndWaitForLoad(url, windowId) {
  return new Promise((resolve, reject) => {
    let tabId = null;
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab load timeout for ${url}`));
    }, 30000);

    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.create({ url, windowId, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      tabId = tab.id;
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
