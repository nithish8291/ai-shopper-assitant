"use client";

import { useState, useCallback } from "react";
import ChatWindow from "@/components/ChatWindow";
import LoginPanel from "@/components/LoginPanel";
import PaymentPanel from "@/components/PaymentPanel";
import ProductCard from "@/components/Productcard";
import { ClientProvider } from "@/lib/clientContext";
import ClientDetails from "@/components/ClientDetails";
import { v4 as uuid } from "uuid";
import CheckoutB2BForm from "@/components/CheckoutB2BForm";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  data?: any;
    type?: "text" | "products" | "cart" | "login" | "payment" | "order" | "suggestions";
}

type ActivePanel = "chat" | "login" | "payment";

const STORE_URL = process.env.NEXT_PUBLIC_VTEX_STORE_URL || "https://your-store.vtexcommercestable.com.br";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("chat");
  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [orderFormId, setOrderFormId] = useState<string>("");

  const addMessage = useCallback((role: Message["role"], content: string, data?: any, type?: Message["type"]) => {
    const msg: Message = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      role,
      content,
      data,
      type,
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const getSessionId = () => {
  if (typeof window === "undefined") return "server-session";
  let id = localStorage.getItem("shopping-session-id");
    if (!id) {
      id = uuid();
      localStorage.setItem("shopping-session-id", id);
    }
    return id;
  }

  const fetchCachedOrderForm = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/orderform?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return null;
      const body = await res.json();
      return body?.orderForm ?? body;
    } catch (err) {
      return null;
    }
  };

  const handleSend = async (message: string, meta?: any) => {
    addMessage("user", message);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          meta: meta ?? null,
          context: {
            orderFormId,
            user,
            selectedProductId: products[0]?.id,
          },
          sessionId: getSessionId(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        addMessage("assistant", data.error || "Sorry, something went wrong.");
        setIsLoading(false);
        return;
      }

      console.log("-------------------data")
      console.log(JSON.stringify(data,null,2));
      
      switch (data.intent) {
        case "search_products": {
          const productList = data.data?.content?.[0]?.text
            ? JSON.parse(data.data.content[0].text)
            : data.data;
          if (Array.isArray(productList) && productList.length > 0) {
            setProducts(productList);
            addMessage("assistant", `Found ${productList.length} product(s) for you:`);
          } else {
            addMessage("assistant", "No products found. Try a different search term.");
          }
          break;
        }

        case "product_detail": {
            if(data?.message){
              addMessage("assistant", data.message);
            }else {
              addMessage("assistant", "No details found for this product.");
            }
            break;
        }

        case "get_sku_details": {
          if(data?.message){
            addMessage("assistant", data.message);
          }else {
            addMessage("assistant", "No details found for this SKU.");
          }
          break;
        }

        case "add_to_cart":
        case "update_item_in_cart": {
          const cartData = data.data?.content?.[0]?.text
            ? JSON.parse(data.data.content[0].text)
            : data.data;
          setCart(cartData);
          if (cartData?.orderFormId) setOrderFormId(cartData.orderFormId);
          // Prefer structured addedItem returned by the executor/tool result
          const added = data.data?.addedItem ?? data.data?.result?.addedItem ?? null;
          if (added && added.name) {
            const priceText = added.price != null ? ` — $${(Number(added.price) / 100).toFixed(2)}` : "";
            const qtyText = added.quantity != null ? ` (x${added.quantity})` : "";
            addMessage("assistant", `Item added successfully to the cart: ${added.name}${qtyText}${priceText}`);
          } else {
            // Fallback: try to infer the added item from the returned cart structure (pick the last item)
            let inferredName: string | null = null;
            let inferredPrice: number | null = null;
            try {
              const items = cartData?.items || cartData?.order?.items || cartData?.orderForm?.items || [];
              if (Array.isArray(items) && items.length > 0) {
                const last = items[items.length - 1];
                inferredName = last?.name || last?.productName || last?.title || null;
                inferredPrice = (last?.sellingPrice ?? last?.price ?? last?.unitPrice) ?? null;
              }
            } catch (err) {
              // ignore
            }

            if (inferredName) {
              const priceText = inferredPrice != null ? ` — $${(Number(inferredPrice) / 100).toFixed(2)}` : "";
              addMessage("assistant", `Item added successfully to the cart: ${inferredName}${priceText}`);
            } else {
              addMessage("assistant", "Added to cart! Say 'show my cart' to view or 'checkout' to proceed.");
            }
          }
          break;
        }
        case "view_cart":
        case "get_cart": {
          if(data?.message){
            addMessage("assistant", data.message);
          }else {
            addMessage("assistant", "No cart information available.");
          }
          break;
        }

        case "checkout":
        case "proceed_to_checkout": {
          // Parse cart payload if present (may be empty)
          let cartData = data.data?.content?.[0]?.text
            ? JSON.parse(data.data.content[0].text)
            : data.data;

          // Prefer explicit backend flag or items array to determine if cart has content
          let hasItems = (Array.isArray(cartData?.items) && cartData.items.length > 0) || cartData?.hasItems === true;

          // If the current payload has no items, try to fetch the cached orderForm from server-side Redis using sessionId
          if (!hasItems) {
            const cached = await fetchCachedOrderForm(getSessionId());
            if (cached) {
              const cachedHasItems = (Array.isArray(cached?.items) && cached.items.length > 0) || cached?.hasItems === true;
              if (cachedHasItems) {
                cartData = cached;
                hasItems = true;
              } else if (cached?.message) {
                addMessage("assistant", cached.message);
                break;
              }
            }
          }

          if (!hasItems) {
            const msg = cartData?.message || data.message || "Your cart is empty. Add items before proceeding to checkout.";
            addMessage("assistant", msg);
            break;
          }

          console.log(cartData);
          // Ready to proceed: ensure cart/orderFormId is stored and render client details inside chat
          setCart(cartData);
          if (cartData?.orderFormId) setOrderFormId(cartData.orderFormId);
          addMessage("assistant", "Proceeding to checkout — please provide client details below.", { render: "clientDetails" }, "payment");
          break;
        }

        case "place_order": {
          const orderResult = data.data?.content?.[0]?.text
            ? JSON.parse(data.data.content[0].text)
            : data.data;
          addMessage("assistant", `Order placed successfully! Order ID: ${orderResult?.orderId || "confirmed"}`);
          setCart(null);
          setProducts([]);
          break;
        }

        default: {
          const text = data.message || data.data?.content?.[0]?.text || JSON.stringify(data.data);
          addMessage("assistant", text);
        }
      }

      // If the assistant returned suggestions array, add them as a suggestions message
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        let suggestions = [...data.suggestions];

        // If intent is search_products but no products were returned, remove the generic 'found several products' suggestion
        if (data.intent === "search_products") {
          const productList = data.data?.content?.[0]?.text
            ? JSON.parse(data.data.content[0].text)
            : data.data;
          const hasProducts = Array.isArray(productList) && productList.length > 0;
          if (!hasProducts) {
            suggestions = suggestions.filter((s: string) => {
              return (
                s !==
                "I found several matching products — would you like to view details for any of them?" &&
                s !== "You can add a product to your cart directly from the listing."
              );
            });
          }
        }
        // If intent is get_cart and the cart is empty, remove cart-related suggestions
        if (data.intent === "get_cart") {
          const cartInfo = data.data?.content?.[0]?.text
            ? JSON.parse(data.data.content[0].text)
            : data.data;
          const itemCount = cartInfo?.items?.length || 0;
          if (itemCount === 0) {
            suggestions = suggestions.filter((s: string) => {
              return (
                s !== "This is your current cart — you can update item quantities or remove items." &&
                s !== "When you're ready, proceed to checkout to enter shipping and payment details." &&
                s !== "You can also apply a coupon code or estimate shipping costs."
              );
            });
          }
        }

        if (suggestions.length > 0) {
          addMessage("assistant", "", suggestions, "suggestions");
        }
      }
    } catch (error) {
      addMessage("assistant", "Sorry, I encountered an error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    setActivePanel("chat");
    addMessage("system", `Logged in successfully! Welcome back.`);
  };

  const handlePaymentComplete = (result: any) => {
    setActivePanel("chat");
    addMessage("assistant", `Payment completed! Your order has been confirmed. ${result?.orderId ? `Order ID: ${result.orderId}` : ""}`);
    setCart(null);
  };

  const handleAddToCart = (skuId: string, displayName?: string) => {
    const userMessage = displayName ? `Add to cart: ${displayName}` : `Add to cart`;
    handleSend(userMessage, { action: "add_to_cart", skuId });
  };

  const handleViewDetails = (skuId: string, displayName?: string) => {
    const userMessage = displayName ? `Show details: ${displayName}` : `Show details`;
    handleSend(userMessage, { action: "get_sku_details", skuId });
  };

  const cartTotal = cart?.totalizers?.[0]?.value
    ? cart.totalizers[0].value / 100
    : 0;

  return (
    <ClientProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-16 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-4 gap-4">
        <button
          onClick={() => setActivePanel("chat")}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${
            activePanel === "chat"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-600"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          title="Chat"
        >
          💬
        </button>
        <button
          onClick={() => setActivePanel("login")}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${
            activePanel === "login"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-600"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          title="Account"
        >
          👤
        </button>
        <button
          onClick={() => setActivePanel("payment")}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${
            activePanel === "payment"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-600"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          title="Payment"
        >
          💳
        </button>

        <div className="mt-auto">
          <div
            className={`w-3 h-3 rounded-full ${user ? "bg-green-500" : "bg-gray-300"}`}
            title={user ? "Logged in" : "Not logged in"}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex">
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
          {activePanel === "chat" && (
            <ChatWindow
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              onClientSaved={() => addMessage("assistant", "Please complete order details below.", { render: "checkoutForm" }, "payment")}
              onCheckoutComplete={(data) => addMessage("assistant", "Cart is ready with your preferences — would you like to place the order?")}
            />
          )}
          {activePanel === "login" && (
            <LoginPanel
              storeUrl={STORE_URL}
              onLoginSuccess={handleLoginSuccess}
              isEmbedded={false}
            />
          )}
          {activePanel === "payment" && (
            <div className="p-4 flex flex-col gap-4">
              <ClientDetails />
              <CheckoutB2BForm />
              <PaymentPanel
                orderFormId={orderFormId}
                cartTotal={cartTotal}
                onPaymentComplete={handlePaymentComplete}
                storeUrl={STORE_URL}
              />
            </div>
          )}
        </div>

        {/* Products Side Panel */}
        {products.length > 0 && activePanel === "chat" && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Products</h3>
              <button
                onClick={() => setProducts([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="space-y-3">
              {products.map((product, i) => (
                <ProductCard
                  key={product.productId || i}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          </div>
        )}
      </main>
      </div>
    </ClientProvider>
  );
}