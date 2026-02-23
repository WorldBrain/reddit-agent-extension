# Reddit Agent — Skill Definition

You are a Reddit agent with access to a Chrome extension that can browse, search, and interact with Reddit on behalf of the user. Use the actions below to accomplish tasks.

## Installation

Install the OpenClaw plugin for the bridge server:

```bash
openclaw plugins install openclaw-reddit-agent-server
```

Then enable it in your OpenClaw configuration:

```json5
{
  plugins: {
    entries: {
      "openclaw-reddit-agent-server": {
        enabled: true,
        config: {
          port: 7071, // optional, default is 7071
        },
      },
    },
  },
}
```

The plugin starts the WebSocket bridge server automatically. No need to run a separate server process.

## Chrome Extension Setup

1. Build the extension: `npm run build` in `packages/extension`
2. Load `dist/` in Chrome at `chrome://extensions/` (Developer mode → Load unpacked)
3. Click the extension icon and set the server URL to `ws://localhost:7071/ws`
4. The extension will auto-connect when OpenClaw starts

## Capabilities

- **Browse** subreddits by any sort order
- **Search** all of Reddit or within a specific subreddit, with sort and time filters
- **Profile** — fetch posts submitted by any Reddit user, with sort and time filters
- **Read** full posts and comment threads
- **Reply** to comments using the user's logged-in Reddit session
- **Self-describe** by returning this skill document

## Connection

The Chrome extension connects via WebSocket at `ws://<host>:7071/ws`. All communication is JSON over that socket.

## Protocol

Every request must include a unique `id` so responses can be matched.

**Request (server → extension):**

```json
{ "id": "<unique-string>", "action": "<action_name>", "params": { ... } }
```

**Success response (extension → server):**

```json
{ "id": "<same-id>", "success": true, "data": <result> }
```

**Error response (extension → server):**

```json
{ "id": "<same-id>", "success": false, "error": "Human-readable error message" }
```

**Keep-alive:** The extension sends `{"type":"ping"}` every 20 seconds. Respond with `{"type":"pong"}`.

---

## Actions

### `get_skill`

Returns this entire skill document as a markdown string. Call this first to discover all available actions, parameters, and response shapes.

**Params:** None.

```json
{ "id": "0", "action": "get_skill", "params": {} }
```

---

### `fetch_subreddit`

Fetches a subreddit's listing (appends `.json` to the URL).

| Param       | Type   | Required | Description                                                    |
| ----------- | ------ | -------- | -------------------------------------------------------------- |
| `url`       | string | yes\*    | Subreddit name or URL (see accepted formats below)             |
| `subreddit` | string | yes\*    | Alias for `url` — use either one                               |
| `sort`      | string | no       | `hot` \| `new` \| `top` \| `rising` \| `best` (default: `hot`) |

\* Provide **either** `url` or `subreddit` (at least one is required). They are interchangeable.

**Accepted formats** for `url`/`subreddit` — all of these are equivalent:

- `"supplements"`
- `"r/supplements"`
- `"/r/supplements"`
- `"https://www.reddit.com/r/supplements"`

```json
{
  "id": "1",
  "action": "fetch_subreddit",
  "params": { "subreddit": "supplements", "sort": "new" }
}
```

Fetches `https://www.reddit.com/r/supplements/new.json`. Omit `sort` for the default listing.

**Response `data`:** Reddit's full listing JSON.

---

### `search_reddit`

Searches Reddit via `/search.json?q=...`. Optionally scope the search to a specific subreddit.

| Param       | Type   | Required | Description                                                        |
| ----------- | ------ | -------- | ------------------------------------------------------------------ |
| `query`     | string | yes      | Search query                                                       |
| `subreddit` | string | no       | Subreddit to search within. Omit to search all of Reddit.          |
| `sort`      | string | no       | `relevance` \| `top` \| `new` \| `comments` (default: `relevance`) |
| `time`      | string | no       | `hour` \| `day` \| `week` \| `month` \| `year` (default: all time) |

`subreddit` accepts the same formats as `fetch_subreddit`: `"supplements"`, `"r/supplements"`, `"/r/supplements"`, or `"https://www.reddit.com/r/supplements"`.

**Search all of Reddit:**

```json
{
  "id": "2",
  "action": "search_reddit",
  "params": {
    "query": "best magnesium supplement",
    "sort": "top",
    "time": "month"
  }
}
```

**Search within a subreddit:**

```json
{
  "id": "2",
  "action": "search_reddit",
  "params": { "query": "test", "subreddit": "Supplements" }
}
```

**Response `data`:** A filtered listing with pagination cursors (`after`/`before`).

```json
{
  "kind": "Listing",
  "data": {
    "after": "t3_abc123",
    "before": null,
    "children": [
      {
        "kind": "t3",
        "data": {
          "id": "1m5v2fy",
          "name": "t3_1m5v2fy",
          "author": "username",
          "author_fullname": "t2_uj2477sf",

          "subreddit": "Creatine",
          "subreddit_name_prefixed": "r/Creatine",
          "subreddit_id": "t5_2x7yu",
          "subreddit_subscribers": 50683,

          "title": "Post title here",
          "selftext": "Body text (empty for link/image posts)",
          "url": "https://i.redd.it/example.jpeg",
          "domain": "i.redd.it",
          "permalink": "/r/Creatine/comments/1m5v2fy/post_title_here/",
          "is_self": false,
          "post_hint": "image",
          "is_video": false,

          "score": 281,
          "ups": 281,
          "downs": 0,
          "upvote_ratio": 0.97,
          "num_comments": 25,
          "num_crossposts": 0,

          "created_utc": 1753132055.0,

          "over_18": false,
          "spoiler": false,
          "locked": false,
          "stickied": false,
          "archived": false,
          "pinned": false,
          "is_original_content": false,

          "media": {
            "reddit_video": {
              "fallback_url": "https://v.redd.it/.../CMAF_1080.mp4?source=fallback",
              "dash_url": "https://v.redd.it/.../DASHPlaylist.mpd?a=...",
              "hls_url": "https://v.redd.it/.../HLSPlaylist.m3u8?a=...",
              "scrubber_media_url": "https://v.redd.it/.../CMAF_96.mp4",
              "width": 1080,
              "height": 1920,
              "duration": 14,
              "bitrate_kbps": 5000,
              "has_audio": true,
              "is_gif": false,
              "transcoding_status": "completed"
            }
          },

          "thumbnail": "image",
          "thumbnail_height": 140,
          "thumbnail_width": 140,
          "preview": {
            "images": [
              {
                "source": {
                  "url": "https://preview.redd.it/example.jpeg?auto=webp&s=...",
                  "width": 870,
                  "height": 968
                }
              }
            ]
          },

          "author_flair_text": "Creatine Addict",
          "link_flair_text": null
        }
      }
    ]
  }
}
```

**Field notes:**

- `media` is `null` for image/text posts — only populated for hosted video posts
- `preview` is omitted for text-only posts
- `post_hint` values: `"image"`, `"hosted:video"`, `"link"`, `"self"`, `"rich:video"`, etc.
- `selftext` contains the body for self/text posts, empty string for link/image posts

---

### `fetch_user_posts`

Fetches posts submitted by a Reddit user. Uses the `/user/<username>/submitted.json` endpoint.

| Param      | Type   | Required | Description                                                                                                      |
| ---------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `username` | string | yes      | Reddit username (e.g. `"richo-s"`). Do not include `u/` or `/u/` prefix.                                         |
| `sort`     | string | no       | `hot` \| `new` \| `top` \| `controversial` (default: `hot`)                                                      |
| `time`     | string | no       | `hour` \| `day` \| `week` \| `month` \| `year` (default: all time). Applies when sort is `top` or `controversial`. |

```json
{
  "id": "5",
  "action": "fetch_user_posts",
  "params": { "username": "richo-s", "sort": "top", "time": "month" }
}
```

Fetches `https://www.reddit.com/user/richo-s/submitted/top.json?t=month`.

**Response `data`:** Same filtered listing format as `search_reddit` — includes pagination cursors (`after`/`before`) and filtered post objects.

---

### `fetch_post`

Fetches a single post and its full comment tree (appends `.json` to the URL).

| Param | Type   | Required | Description   |
| ----- | ------ | -------- | ------------- |
| `url` | string | yes      | Full post URL |

```json
{
  "id": "3",
  "action": "fetch_post",
  "params": {
    "url": "https://www.reddit.com/r/supplements/comments/abc123/some_post/"
  }
}
```

**Response `data`:** Reddit's full post + comments JSON.

---

### `reply_to_comment`

Posts a reply to a comment using the user's active Reddit session in Chrome. Opens the comment in a background tab, interacts with the DOM to submit the reply, then closes the tab.

| Param        | Type   | Required | Description               |
| ------------ | ------ | -------- | ------------------------- |
| `commentUrl` | string | yes      | Direct URL to the comment |
| `replyText`  | string | yes      | Reply body text           |

```json
{
  "id": "4",
  "action": "reply_to_comment",
  "params": {
    "commentUrl": "https://www.reddit.com/r/supplements/comments/abc123/some_post/def456/",
    "replyText": "Great point, thanks for sharing!"
  }
}
```

**Response `data`:**

```json
{ "success": true, "message": "Reply posted successfully" }
```

**Notes:**

- Requires an active Reddit login session in Chrome
- Slower (~7 s) due to DOM interaction
- Tab auto-closes after submission
