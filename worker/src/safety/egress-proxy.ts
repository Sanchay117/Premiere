// Local HTTP proxy that every browser connection goes through. It resolves each hostname
// itself, refuses private and special addresses, and connects to the exact IP it checked.
// Because the check happens per connection, it covers redirects, subresources, iframes and
// DNS rebinding, which a request-level filter in Playwright does not (redirect hops skip it).

import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { resolvePublicHost } from "./url-guard";

const HOP_BY_HOP = ["proxy-connection", "proxy-authorization", "connection", "keep-alive", "te", "trailer", "upgrade"];
const SOCKET_TIMEOUT_MS = 30_000;

export interface EgressProxy {
  /** Pass to Playwright as `proxy: { server }`. */
  server: string;
  /** Hosts refused during this job. */
  blocked: Set<string>;
  close(): Promise<void>;
}

export interface EgressProxyOptions {
  /** Address resolver; tests swap it to stand in for public DNS. Must throw for unsafe hosts. */
  resolveHost?: (hostname: string) => Promise<string[]>;
}

export async function startEgressProxy({ resolveHost = resolvePublicHost }: EgressProxyOptions = {}): Promise<EgressProxy> {
  const blocked = new Set<string>();
  const lookups = new Map<string, Promise<string[]>>();

  const resolve = (hostname: string): Promise<string[] | null> => {
    let pending = lookups.get(hostname);
    if (!pending) {
      pending = resolveHost(hostname);
      lookups.set(hostname, pending);
    }
    return pending.catch(() => {
      blocked.add(hostname);
      return null;
    });
  };

  const server = http.createServer(async (req, res) => {
    let target: URL;
    try {
      target = new URL(req.url ?? "");
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (target.protocol !== "http:") {
      res.writeHead(400).end();
      return;
    }
    const addresses = await resolve(target.hostname);
    if (!addresses?.[0]) {
      res.writeHead(403, { "content-type": "text/plain" }).end("Blocked by Premiere: private or unknown address.");
      return;
    }
    const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host };
    for (const name of HOP_BY_HOP) delete headers[name];
    const upstream = http.request(
      {
        host: addresses[0],
        port: Number(target.port) || 80,
        method: req.method,
        path: `${target.pathname}${target.search}`,
        headers,
        setHost: false,
        timeout: SOCKET_TIMEOUT_MS,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });

  // Every socket this proxy touches, so close() can tear them all down. Tunnel sockets are not
  // tracked by the HTTP server once upgraded, and a half-open one would block server.close().
  const sockets = new Set<net.Socket>();
  const track = (socket: net.Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  };
  server.on("connection", track);

  // HTTPS and WebSocket traffic arrives as CONNECT host:port tunnels.
  server.on("connect", async (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    track(client);
    client.on("error", () => {});
    let hostname: string;
    let port: number;
    try {
      const parsed = new URL(`http://${req.url ?? ""}`);
      hostname = parsed.hostname;
      port = Number(parsed.port) || 443;
    } catch {
      client.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    const addresses = await resolve(hostname);
    if (!addresses?.[0]) {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const upstream = net.connect({ host: addresses[0], port });
    track(upstream);
    upstream.setTimeout(SOCKET_TIMEOUT_MS, () => upstream.destroy());
    let established = false;
    upstream.on("connect", () => {
      established = true;
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on("error", () => {
      if (!established && client.writable) client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      else client.destroy();
    });
    // When either side finishes, finish the other, so no tunnel is left half-open.
    client.on("end", () => upstream.end());
    upstream.on("end", () => client.end());
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });

  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;

  return {
    server: `http://127.0.0.1:${port}`,
    blocked,
    close: () =>
      new Promise<void>((done) => {
        for (const socket of sockets) socket.destroy();
        server.closeAllConnections();
        // Never let shutdown hang a job: resolve after a second regardless.
        const timer = setTimeout(done, 1000);
        server.close(() => {
          clearTimeout(timer);
          done();
        });
      }),
  };
}
