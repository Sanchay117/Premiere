// USDC payments on Base through x402 (protocol v2). Off for Vibeathon 02: every trailer is free
// until the event ends. Switch on with PAYMENTS=testnet (Base Sepolia) or PAYMENTS=mainnet (Base).
// People pay through the same x402 flow from the website (their wallet signs a USDC
// authorization and the facilitator settles it on-chain), so people and agents share one path.
// Nothing here holds a private key: the facilitator submits the transfer, we only verify it.

import "../config";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

export type PaymentsMode = "off" | "testnet" | "mainnet";

/** Facilitators: x402.org settles Base Sepolia for free; PayAI settles Base mainnet without an API key. */
export const NETWORKS = {
  testnet: {
    id: "eip155:84532",
    name: "Base Sepolia",
    chainId: 84532,
    facilitator: "https://x402.org/facilitator",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  mainnet: {
    id: "eip155:8453",
    name: "Base",
    chainId: 8453,
    facilitator: "https://facilitator.payai.network",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
} as const;

function parseMode(raw: string | undefined): PaymentsMode {
  const value = raw?.trim().toLowerCase();
  return value === "testnet" || value === "mainnet" ? value : "off";
}

export const paymentConfig = {
  mode: parseMode(process.env.PAYMENTS),
  payTo: process.env.PAYMENT_ADDRESS?.trim() ?? "",
  priceUsd: Number(process.env.PRICE_USDC) > 0 ? Number(process.env.PRICE_USDC) : 3,
  facilitatorUrl: process.env.X402_FACILITATOR_URL?.trim() || null,
  /** Where the site is served, for the resource URL in payment requirements. */
  publicUrl: (process.env.PUBLIC_URL?.trim() || "http://localhost:3000").replace(/\/$/, ""),
};

const isAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value);

/** On only with a network chosen and a valid receiving address; otherwise paid routes refuse. */
export function paymentsEnabled(config = paymentConfig): boolean {
  return config.mode !== "off" && isAddress(config.payTo);
}

export interface Pricing {
  free: boolean;
  mode: PaymentsMode;
  priceUsd: number;
  network: string | null;
  networkName: string | null;
  payTo: string | null;
  asset: string | null;
}

export function pricing(config = paymentConfig): Pricing {
  if (!paymentsEnabled(config)) {
    return { free: true, mode: "off", priceUsd: config.priceUsd, network: null, networkName: null, payTo: null, asset: null };
  }
  const net = NETWORKS[config.mode as "testnet" | "mainnet"];
  return { free: false, mode: config.mode, priceUsd: config.priceUsd, network: net.id, networkName: net.name, payTo: config.payTo, asset: net.usdc };
}

let server: Promise<x402ResourceServer> | null = null;

function resourceServer(): Promise<x402ResourceServer> {
  server ??= (async () => {
    const net = NETWORKS[paymentConfig.mode as "testnet" | "mainnet"];
    const facilitator = new HTTPFacilitatorClient({ url: paymentConfig.facilitatorUrl ?? net.facilitator, timeoutMs: 60_000 });
    const rs = new x402ResourceServer(facilitator).register(net.id, new ExactEvmScheme());
    await rs.initialize();
    return rs;
  })().catch((err) => {
    server = null;
    throw err;
  });
  return server;
}

export const TRAILER_RESOURCE = {
  description: "One Premiere launch trailer: about 45 seconds, 1920x1080, narrated, captioned and scored, with two thumbnails.",
  mimeType: "application/json",
};

export type Charge =
  | { ok: true; payer: string; transaction: string; headers: Record<string, string> }
  | { ok: false; status: 402 | 502 | 503; headers: Record<string, string>; error: string };

/**
 * Takes payment for one trailer. With no PAYMENT-SIGNATURE header it answers 402 with the payment
 * requirements; with one, it verifies and settles before the job starts, so a trailer is never
 * made for a payment that did not land.
 */
export async function charge(signature: string | undefined): Promise<Charge> {
  if (!paymentsEnabled()) return { ok: false, status: 503, headers: {}, error: "Payments are switched off." };
  let rs: x402ResourceServer;
  try {
    rs = await resourceServer();
  } catch {
    return { ok: false, status: 502, headers: {}, error: "The payment network did not answer. Try again in a minute." };
  }
  const net = NETWORKS[paymentConfig.mode as "testnet" | "mainnet"];
  const [requirements] = await rs.buildPaymentRequirements({
    scheme: "exact",
    network: net.id,
    payTo: paymentConfig.payTo,
    price: `$${paymentConfig.priceUsd}`,
    maxTimeoutSeconds: 300,
  });
  if (!requirements) return { ok: false, status: 503, headers: {}, error: "Payments are not set up for this network." };
  const resource = { url: `${paymentConfig.publicUrl}/api/x402/trailers`, ...TRAILER_RESOURCE };
  const required = async (error: string): Promise<Charge> => ({
    ok: false,
    status: 402,
    headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(await rs.createPaymentRequiredResponse([requirements], resource, error)) },
    error,
  });

  if (!signature) return required(`A trailer costs $${paymentConfig.priceUsd} in USDC on ${net.name}.`);
  let payload: ReturnType<typeof decodePaymentSignatureHeader>;
  try {
    payload = decodePaymentSignatureHeader(signature);
  } catch {
    return required("The PAYMENT-SIGNATURE header could not be read.");
  }
  try {
    const verified = await rs.verifyPayment(payload, requirements);
    if (!verified.isValid) return required(`Payment rejected: ${verified.invalidReason ?? "invalid payment"}.`);
    const settled = await rs.settlePayment(payload, requirements);
    if (!settled.success) return required(`Payment did not settle: ${settled.errorReason ?? "unknown reason"}.`);
    return {
      ok: true,
      payer: settled.payer ?? verified.payer ?? "",
      transaction: settled.transaction,
      headers: { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled) },
    };
  } catch (err) {
    console.error("x402 payment failed:", err);
    return { ok: false, status: 502, headers: {}, error: "The payment could not be confirmed. If USDC left your wallet, contact us before paying again." };
  }
}
