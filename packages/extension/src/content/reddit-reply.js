function deepQuerySelectorAll(root, selector) {
  const results = [...root.querySelectorAll(selector)];
  const allElements = root.querySelectorAll("*");

  for (const element of allElements) {
    if (element.shadowRoot) {
      results.push(...deepQuerySelectorAll(element.shadowRoot, selector));
    }
  }

  return results;
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
        error: "faceplate-textarea-input not found inside comment-composer-host",
      };
    }

    const label = input.shadowRoot?.querySelector("label");
    if (!label) {
      return {
        success: false,
        error: "label not found in faceplate-textarea-input shadow root",
      };
    }

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
      const replyButton =
        root.querySelector('button[data-testid="comment-reply-button"]') ||
        root.querySelector('button[aria-label="Reply"]');

      if (replyButton) {
        replyButton.click();
        return { success: true };
      }

      const allButtons = root.querySelectorAll("button");
      for (const button of allButtons) {
        if (button.textContent?.trim().toLowerCase() === "reply") {
          button.click();
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
    const allButtons = deepQuerySelectorAll(document, "button");
    let submitButton = allButtons.find(
      (button) => button.type === "submit" && button.getBoundingClientRect().width > 0,
    );

    if (!submitButton) {
      const submitTexts = ["comment", "reply"];
      submitButton = allButtons.find((button) => {
        const text = button.textContent?.trim().toLowerCase();
        return (
          button.getBoundingClientRect().width > 0 &&
          submitTexts.includes(text)
        );
      });
    }

    if (!submitButton) {
      const hosts = deepQuerySelectorAll(document, "comment-composer-host");
      for (const host of hosts) {
        const hostButtons = deepQuerySelectorAll(host, "button");
        const candidate = hostButtons.find((button) => {
          const text = button.textContent?.trim().toLowerCase();
          return (
            button.getBoundingClientRect().width > 0 &&
            (button.type === "submit" || text === "comment" || text === "reply")
          );
        });
        if (candidate) {
          submitButton = candidate;
          break;
        }
      }
    }

    if (!submitButton) {
      const visibleButtons = allButtons.filter(
        (button) => button.getBoundingClientRect().width > 0,
      );
      const buttonTexts = visibleButtons
        .map((button) => `"${button.textContent?.trim().substring(0, 30)}" type=${button.type}`)
        .join(", ");
      return {
        success: false,
        error: `No Comment or Reply button found. ${visibleButtons.length} visible buttons: [${buttonTexts}]`,
      };
    }

    submitButton.click();
    return {
      success: true,
      method: "submit-button",
      buttonText: submitButton.textContent?.trim(),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function verifyCommentPosted(replyTextSubstring) {
  try {
    const toasts = [
      ...deepQuerySelectorAll(document, '[role="alert"]'),
      ...deepQuerySelectorAll(document, "faceplate-toast"),
    ];
    const errorToast = toasts.find((element) => {
      const text = element.textContent?.toLowerCase() || "";
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

    const textareas = deepQuerySelectorAll(document, "textarea");
    const activeTextarea = textareas.find(
      (textarea) =>
        textarea.getBoundingClientRect().width > 0 &&
        textarea.getBoundingClientRect().height > 0,
    );
    const composerCleared = !activeTextarea || activeTextarea.value?.trim() === "";

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

    const textarea = input.shadowRoot?.querySelector("textarea");
    if (!textarea) {
      return {
        success: false,
        error:
          "textarea not found in faceplate-textarea-input shadow root (editor may not be activated yet)",
      };
    }

    textarea.focus();
    textarea.select();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, replyText);

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
    const allInputs = deepQuerySelectorAll(document, "faceplate-textarea-input");
    const inputField = allInputs.find((input) => {
      const rect = input.getBoundingClientRect();
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.scope !== "reddit-agent-reply") return;

  try {
    let result;
    switch (message.type) {
      case "activate_top_level_composer":
        result = activateTopLevelComposer();
        break;
      case "click_reply_button":
        result = clickReplyButton(message.payload?.commentUrl);
        break;
      case "type_top_level_comment":
        result = typeTopLevelComment(message.payload?.replyText);
        break;
      case "type_comment_reply":
        result = typeAndSubmitReply(message.payload?.replyText);
        break;
      case "submit_comment":
        result = submitComment();
        break;
      case "verify_comment_posted":
        result = verifyCommentPosted(message.payload?.replyTextSubstring);
        break;
      default:
        result = {
          success: false,
          error: `Unknown action: ${message.type}`,
        };
    }
    sendResponse(result);
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
  return true;
});

