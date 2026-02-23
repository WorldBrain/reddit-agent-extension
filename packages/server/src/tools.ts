import { Type } from "@sinclair/typebox";
import type { WebSocketBridge } from "./ws-bridge.js";

const REPLY_TIMEOUT_MS = 90_000;

interface ToolConfig {
  name: string;
  description: string;
  parameters: unknown;
  execute: (
    id: string,
    params: Record<string, unknown>
  ) => Promise<{ content: { type: "text"; text: string }[] }>;
}

export function registerRedditTools(
  registerTool: (config: ToolConfig) => void,
  bridge: WebSocketBridge
) {
  registerTool({
    name: "reddit_fetch_subreddit",
    description:
      "Fetch a subreddit's listing from Reddit. Accepts subreddit name, r/name, " +
      "or full URL. Optionally specify sort order (hot, new, top, rising, best).",
    parameters: Type.Object({
      subreddit: Type.String({
        description:
          'Subreddit name or URL. Accepts: "supplements", "r/supplements", ' +
          '"/r/supplements", or "https://www.reddit.com/r/supplements".',
      }),
      sort: Type.Optional(
        Type.Unsafe<"hot" | "new" | "top" | "rising" | "best">({
          type: "string",
          enum: ["hot", "new", "top", "rising", "best"],
          description: "Sort order. Default: hot.",
        })
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const data = await bridge.sendAction("fetch_subreddit", {
        subreddit: params.subreddit,
        sort: params.sort,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  });

  registerTool({
    name: "reddit_search",
    description:
      "Search Reddit for posts matching a query. Optionally scope to a specific " +
      "subreddit. Supports sort (relevance, top, new, comments) and time " +
      "filters (hour, day, week, month, year).",
    parameters: Type.Object({
      query: Type.String({ description: "Search query string." }),
      subreddit: Type.Optional(
        Type.String({
          description:
            "Subreddit to search within. Omit to search all of Reddit. " +
            'Accepts same formats as reddit_fetch_subreddit (e.g. "supplements").',
        })
      ),
      sort: Type.Optional(
        Type.Unsafe<"relevance" | "top" | "new" | "comments">({
          type: "string",
          enum: ["relevance", "top", "new", "comments"],
          description: "Sort order for results. Default: relevance.",
        })
      ),
      time: Type.Optional(
        Type.Unsafe<"hour" | "day" | "week" | "month" | "year">({
          type: "string",
          enum: ["hour", "day", "week", "month", "year"],
          description: "Time filter. Default: all time.",
        })
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const data = await bridge.sendAction("search_reddit", {
        query: params.query,
        subreddit: params.subreddit,
        sort: params.sort,
        time: params.time,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  });

  registerTool({
    name: "reddit_fetch_user_posts",
    description:
      "Fetch posts submitted by a Reddit user. Provide the username. " +
      "Supports sort (hot, new, top, controversial) and time filters " +
      "(hour, day, week, month, year).",
    parameters: Type.Object({
      username: Type.String({
        description:
          'Reddit username (e.g. "richo-s"). Do not include u/ or /u/ prefix.',
      }),
      sort: Type.Optional(
        Type.Unsafe<"hot" | "new" | "top" | "controversial">({
          type: "string",
          enum: ["hot", "new", "top", "controversial"],
          description: "Sort order. Default: hot.",
        })
      ),
      time: Type.Optional(
        Type.Unsafe<"hour" | "day" | "week" | "month" | "year">({
          type: "string",
          enum: ["hour", "day", "week", "month", "year"],
          description: "Time filter (applies when sort is top or controversial). Default: all time.",
        })
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const data = await bridge.sendAction("fetch_user_posts", {
        username: params.username,
        sort: params.sort,
        time: params.time,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  });

  registerTool({
    name: "reddit_fetch_post",
    description:
      "Fetch a single Reddit post and its full comment tree. Provide the full post URL.",
    parameters: Type.Object({
      url: Type.String({
        description:
          "Full Reddit post URL (e.g. https://www.reddit.com/r/supplements/comments/abc123/some_post/).",
      }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const data = await bridge.sendAction("fetch_post", {
        url: params.url,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  });

  registerTool({
    name: "reddit_reply",
    description:
      "Reply to a Reddit comment or post using the user's logged-in session in Chrome. " +
      "Requires the Reddit Agent Chrome extension to be connected and the user to be " +
      "logged into Reddit. Takes ~7-10 seconds due to DOM interaction.",
    parameters: Type.Object({
      commentUrl: Type.String({
        description: "Direct URL to the comment or post to reply to.",
      }),
      replyText: Type.String({
        description: "The reply text to post.",
      }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const data = await bridge.sendAction(
        "reply_to_comment",
        {
          commentUrl: params.commentUrl,
          replyText: params.replyText,
        },
        REPLY_TIMEOUT_MS
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  });
}
