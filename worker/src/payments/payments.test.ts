import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentsEnabled, pricing } from "./index";

const base = { priceUsd: 3, facilitatorUrl: null, publicUrl: "https://premiere.example" };
const address = "0x75EcC1D69Ca9E7660B9aFC36b141F774a103C438";

test("trailers stay free unless a network and a valid receiving address are both set", () => {
  assert.equal(paymentsEnabled({ ...base, mode: "off", payTo: address }), false);
  assert.equal(paymentsEnabled({ ...base, mode: "mainnet", payTo: "" }), false);
  assert.equal(paymentsEnabled({ ...base, mode: "mainnet", payTo: "0x1234" }), false);
  assert.equal(paymentsEnabled({ ...base, mode: "testnet", payTo: address }), true);
  assert.deepEqual(pricing({ ...base, mode: "off", payTo: address }), {
    free: true,
    mode: "off",
    priceUsd: 3,
    network: null,
    networkName: null,
    payTo: null,
    asset: null,
  });
});

test("paid pricing names Base and its USDC contract", () => {
  const paid = pricing({ ...base, mode: "mainnet", payTo: address });
  assert.equal(paid.free, false);
  assert.equal(paid.network, "eip155:8453");
  assert.equal(paid.asset, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  assert.equal(paid.payTo, address);
});
