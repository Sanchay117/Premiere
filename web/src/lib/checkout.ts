// Pays for one trailer from the browser over x402, with the visitor's own wallet (MetaMask or any
// EIP-1193 wallet): the wallet signs a USDC transfer authorization, the worker's facilitator
// settles it on Base, and the job starts. The page loads this module only when payments are on.
// No key ever leaves the wallet; Premiere only sees the signed authorization.

import type { Pricing } from "./types";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

export async function payAndOrder(pricing: Pricing, order: Record<string, unknown>): Promise<{ id: string }> {
  const ethereum = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  if (!ethereum) throw new Error("No wallet found. Install MetaMask, or open this page in your wallet's browser.");
  if (!pricing.network) throw new Error("Payments are not set up.");

  const [{ createWalletClient, custom }, chains, { x402Client, wrapFetchWithPayment }, { ExactEvmScheme }] = await Promise.all([
    import("viem"),
    import("viem/chains"),
    import("@x402/fetch"),
    import("@x402/evm/exact/client"),
  ]);
  const chain = pricing.mode === "mainnet" ? chains.base : chains.baseSepolia;
  const wallet = createWalletClient({ chain, transport: custom(ethereum) });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("The wallet did not share an address.");
  try {
    await wallet.switchChain({ id: chain.id });
  } catch {
    await wallet.addChain({ chain });
    await wallet.switchChain({ id: chain.id });
  }

  const signer = {
    address: account,
    signTypedData: (message: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) =>
      wallet.signTypedData({ account, ...message } as never),
  };
  // The price is on the ticket before the wallet asks, so the client's own $1 cap is lifted.
  const client = new x402Client().setSpendControls(false).register(pricing.network as `${string}:${string}`, new ExactEvmScheme(signer));
  const pay = wrapFetchWithPayment(fetch, client);
  const response = await pay("/api/x402/trailers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!response.ok || !data.id) throw new Error(data.error ?? `The payment did not go through (${response.status}).`);
  return { id: data.id };
}
