import { Redis } from "@upstash/redis";



export interface ProductSkuDTO {
  skuId?: string;
  price?: number;
  available?: boolean;
  seller?: string;
  referenceId: string;
  imageUrl?: string;
  name?: string;
}

export interface Product {
  productId: string;
  productName: string;
  brand?: string;
  category?: string;
  linkText?: string;
  description?: string;
  FAQ?: string;
  defaultSku: ProductSkuDTO[];
  skuOptions: ProductSkuDTO[];
}

export interface ShoppingContext {
  cartId?: string;
  lastProducts?: Product[];
  selectedProduct?: ProductSkuDTO;
  selectedSku?: string;
  orderFormId?: string;
  customerData?: Record<string, unknown>;
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SESSION_TTL = 60 * 60 * 24; // 24 hours

function sessionKey(sessionId: string): string {
  return `shopping:session:${sessionId}`;
}

export async function getShoppingContext(
  sessionId: string
): Promise<ShoppingContext> {
  const data = await redis.get<ShoppingContext>(sessionKey(sessionId));
  return data ?? {};
}

export async function setShoppingContext(
  sessionId: string,
  context: ShoppingContext
): Promise<void> {
  await redis.set(sessionKey(sessionId), context, { ex: SESSION_TTL });
}

export async function updateShoppingContext(
  sessionId: string,
  patch: Partial<ShoppingContext>
): Promise<ShoppingContext> {
  const current = await getShoppingContext(sessionId);
  const updated = { ...current, ...patch };
  await setShoppingContext(sessionId, updated);
  return updated;
}

export async function clearShoppingContext(
  sessionId: string
): Promise<void> {
  await redis.del(sessionKey(sessionId));
}
