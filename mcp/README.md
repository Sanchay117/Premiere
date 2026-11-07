# Premiere MCP server

Lets a coding agent (Claude Code, Claude Desktop, Cursor or any other MCP client) order a launch trailer of the app it just built. Premiere opens the app in a real browser, writes a script, films the main flow and returns a narrated trailer of about 45 seconds with captions, music, two thumbnails and an SRT, about two to three minutes later.

The server runs on your machine over stdio and calls a Premiere site's public API, the same x402 route any agent can use, so it needs no API key. Trailers are free until 16 Nov 2026, within daily limits. After that a trailer costs a few USDC on Base, paid over x402; this server holds no wallet, so it tells the agent the price and how to pay instead.

## What you need

- Node 22 or later.
- This repository, with `npm install` run at its root (the server loads the MCP SDK and zod from there).
- The address of a Premiere site, set as `PREMIERE_URL`. Without it the server uses `http://localhost:3000`, the site `npm run dev` starts.

Below, replace `/path/to/Premiere` with the repository's absolute path and `https://your-premiere-site` with the site's address.

## Claude Code

```bash
claude mcp add --env PREMIERE_URL=https://your-premiere-site --scope user premiere -- npx -y tsx /path/to/Premiere/mcp/src/index.ts
```

Options go before the name, `premiere`, and everything after `--` is the command that starts the server. `--scope user` makes it available in every project; leave it out to add it to the current project only. Check it with `claude mcp list`, or `/mcp` inside a session.

On Windows, npx needs a `cmd /c` in front (`-- cmd /c npx -y tsx C:/path/to/Premiere/mcp/src/index.ts`), or use node directly, as described under [Without npx](#without-npx).

## Claude Desktop

Settings > Developer > Edit Config opens `claude_desktop_config.json` (in `~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows). Add the server and restart Claude Desktop:

```json
{
  "mcpServers": {
    "premiere": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/Premiere/mcp/src/index.ts"],
      "env": { "PREMIERE_URL": "https://your-premiere-site" }
    }
  }
}
```

If Claude Desktop cannot find `npx` (common when Node comes from nvm), put the full path that `which npx` prints in `command`.

## Cursor

Add the same block to `~/.cursor/mcp.json` (every project) or to `.cursor/mcp.json` in one project:

```json
{
  "mcpServers": {
    "premiere": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/Premiere/mcp/src/index.ts"],
      "env": { "PREMIERE_URL": "https://your-premiere-site" }
    }
  }
}
```

## Without npx

Node 22.18 and later run TypeScript files themselves, so `node /path/to/Premiere/mcp/src/index.ts` works wherever the setups above use `npx -y tsx` (`"command": "node"`, `"args": ["/path/to/Premiere/mcp/src/index.ts"]`). It starts in under a second instead of a few, and needs no `cmd /c` on Windows. Do not start the server with `npm run`: npm prints a banner on stdout, which is the channel the client reads.

## Tools

| Tool | Inputs | Returns |
| --- | --- | --- |
| `make_trailer` | `url` (required, public); `style` hype or walkthrough; `voice` auto or one of eight narrators; `captions` karaoke, boxed, bold or off; `length` 15, 30 or 45 seconds; `format` landscape or vertical; `notes`, director's notes up to 280 characters; `demo_url`, a link that opens the app signed in to a demo account; `gallery` (default false); `access_code`, only if Premiere asks for one | The job id and its screening room link, at once |
| `trailer_status` | `id`; `wait_seconds`, 0 to 240 (default 0) | Where the job stands. When it is done: the duration, the narrator, any notes, and links to `trailer.mp4`, both thumbnails, `captions.srt` and the screening room |
| `premiere_options` | none | Every choice with a word on each, what a trailer comes with, and the price |

- **Waiting.** With `wait_seconds`, `trailer_status` checks every 5 seconds until the trailer is done or failed, and sends progress notifications meanwhile to clients that ask for them. Some clients cut a tool call off after 60 seconds; the tool tells the agent to use `wait_seconds` 50 if that happens. In Claude Code, `MCP_TOOL_TIMEOUT` (in milliseconds) sets that limit.
- **Public apps only.** Premiere refuses localhost and private network addresses, so deploy first (a preview URL works). It stays on public pages unless `demo_url` signs it in.
- **Gallery off.** Orders from agents stay out of the public gallery unless `gallery` is true, since the app may be a private or staging build.
- **The demo link is a secret.** The server never repeats `demo_url` and cuts it out of anything the site says back. Use a throwaway demo account: anything it shows may be filmed.
- **Payment.** When trailers cost money, `make_trailer` answers with the price and the x402 payment details instead of a job. An x402-capable client can pay at `POST /api/x402/trailers`, and people can pay on the website.

## Example

> Make a launch trailer of my app at https://yourapp.xyz and give me the links when it is done.

The agent calls `make_trailer`, then `trailer_status` with a wait, and answers from what comes back. This is a walkthrough of example.com made through this server, 98 seconds after the order (links shortened):

```
Status: done. "Example Domain", 42.4 s.
Cut: walkthrough. Narrator: Athena. Captions: karaoke. Format: landscape.
Trailer: https://your-premiere-site/api/jobs/<id>/files/trailer.mp4
Thumbnail: https://your-premiere-site/api/jobs/<id>/files/thumbnail-1920.png
Thumbnail: https://your-premiere-site/api/jobs/<id>/files/thumbnail-1280.png
Captions (SRT): https://your-premiere-site/api/jobs/<id>/files/captions.srt
Screening room (watch, download, share): https://your-premiere-site/jobs/<id>
Add ?download=1 to a file link to download it under its own name.
```

Other prompts that work: "Make a 30 second vertical trailer of https://yourapp.xyz read by Draco", "Make a trailer of https://yourapp.xyz that types a prompt into the generator and clicks Generate" (that becomes the director's notes), "What narrators can Premiere use?"

## Develop

```bash
npm run -w mcp typecheck
npx @modelcontextprotocol/inspector npx tsx mcp/src/index.ts
```

The inspector opens a page for calling each tool by hand. `src/index.ts` holds the server and its tools, `src/site.ts` the calls to the site, `src/report.ts` the status text, and `src/options.ts` the choices.
