import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId query parameter is required" }, { status: 400 });
    }

    // Try several common key patterns so this endpoint works with different cache keys
        // Prefer canonical key `orderform:${sessionId}`
        const key = `orderform:${sessionId}`;
        let raw: string | null = null;
        try {
          const v = await redis.get(key as string);
          if (v != null) raw = typeof v === "string" ? v : JSON.stringify(v);
        } catch (err) {
          // ignore
        }

        if (!raw) {
          return NextResponse.json({ error: "Order form not found" }, { status: 404 });
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          parsed = raw;
        }

        return NextResponse.json({ orderForm: parsed });
  } catch (error) {
    console.error("/api/orderform error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

    export async function POST(req: NextRequest) {
      try {
        const body = await req.json();
        const sessionId = body?.sessionId;
        const orderForm = body?.orderForm ?? body?.orderform ?? body?.order;
        const ttl = typeof body?.ttl === "number" ? body.ttl : undefined; // seconds

        if (!sessionId || !orderForm) {
          return NextResponse.json({ error: "sessionId and orderForm are required" }, { status: 400 });
        }

        const key = `orderform:${sessionId}`;
        const value = typeof orderForm === "string" ? orderForm : JSON.stringify(orderForm);

        // Store in Redis. If ttl provided, set expire afterwards.
        await redis.set(key, value);
        if (ttl && Number.isInteger(ttl) && ttl > 0) {
          try {
            await redis.expire(key, ttl);
          } catch (err) {
            // ignore expire failure
          }
        }

        return NextResponse.json({ ok: true, key });
      } catch (err) {
        console.error("/api/orderform POST error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }
