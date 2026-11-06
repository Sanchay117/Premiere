import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPublicUrl, isPublicAddress, UnsafeUrlError } from "./url-guard";

test("public and private addresses", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111", "64:ff9b::808:808"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00:ec2::254",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
    "2001:db8::1",
  ]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test("rejects unsafe URLs before any network access", async () => {
  const unsafe = [
    "http://localhost:3000",
    "localhost:3000",
    "http://127.0.0.1",
    "http://0x7f000001/",
    "http://2130706433/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://10.0.0.5",
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/",
    "http://intranet/",
    "http://printer.local/",
    "ftp://example.com/",
    "file:///etc/passwd",
    "https://user:pass@example.com/",
  ];
  for (const url of unsafe) {
    await assert.rejects(assertPublicUrl(url), UnsafeUrlError, url);
  }
});
