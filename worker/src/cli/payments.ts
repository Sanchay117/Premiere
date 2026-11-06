// npm run payments
// Shows whether trailers are free or paid with the current .env, and, when paid, the exact 402
// payment requirements an x402 client receives (fetched live from the facilitator). Nothing is
// charged. Use it after changing PAYMENTS, PAYMENT_ADDRESS or PRICE_USDC.

import { decodePaymentRequiredHeader } from "@x402/core/http";
import { charge, paymentConfig, pricing } from "../payments";

const now = pricing();
if (now.free) {
  console.log(`Trailers are free (PAYMENTS=${paymentConfig.mode}${paymentConfig.mode !== "off" ? ", but PAYMENT_ADDRESS is missing or invalid" : ""}).`);
  console.log(`When switched on, a trailer will cost $${now.priceUsd} in USDC.`);
} else {
  console.log(`Paid: $${now.priceUsd} in USDC on ${now.networkName} (${now.network}), to ${now.payTo}.`);
  const unpaid = await charge(undefined);
  if (unpaid.ok) {
    console.log("Unexpected: an unsigned request was accepted.");
  } else if (unpaid.headers["PAYMENT-REQUIRED"]) {
    console.log(`An unpaid request gets ${unpaid.status} with these requirements:`);
    console.log(JSON.stringify(decodePaymentRequiredHeader(unpaid.headers["PAYMENT-REQUIRED"]), null, 2));
  } else {
    console.log(`An unpaid request gets ${unpaid.status}: ${unpaid.error}`);
  }
}
