export type PaymentSystem = Record<string, any>;

function uniqBy<T>(arr: T[], keyFn: (t: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

function normalizeKey(ps: PaymentSystem) {
  const raw = (ps.paymentSystemName || ps.name || ps.id || "").toString().toLowerCase();
  if (!raw) return "custom";
  if (/credit|card|visa|mastercard|amex/.test(raw)) return "CreditCard";
  if (/braintree|paypal/.test(raw)) return "Paypal";
  if (/echeck|ach/.test(raw)) return "echeck";
  if (/promissory|invoice|boleto|banktransfer|pay-on-delivery/.test(raw)) return "Promissory";
  return "custom";
}

export function groupPaymentSystems(orderForm: any) {
  console.log(orderForm);
    
  const systems: PaymentSystem[] = ((orderForm || {}).paymentData || {}).paymentSystems || [];

  const unique = uniqBy(systems, (p) => (p.groupName || "").toString());
  return unique.map((u) => normalizeKey(u));
}
