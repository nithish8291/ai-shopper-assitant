"use client";

import { useState, useCallback } from "react";
import ChatWindow from "@/components/ChatWindow";
import LoginPanel from "@/components/LoginPanel";
import PaymentPanel from "@/components/PaymentPanel";
import ProductCard from "@/components/Productcard";
import { v4 as uuid } from "uuid";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  data?: any;
  type?: "text" | "products" | "cart" | "login" | "payment" | "order";
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
  let id = sessionStorage.getItem("shopping-session-id");
    if (!id) {
      id = uuid();
      sessionStorage.setItem("shopping-session-id", id);
    }
    return id;
  }

  const handleSend = async (message: string) => {
    addMessage("user", message);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
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
          addMessage("assistant", "Added to cart! Say 'show my cart' to view or 'checkout' to proceed.");
          break;
        }

        case "get_cart": {
          const cartInfo = data.data?.content?.[0]?.text
            ? JSON.parse(data.data.content[0].text)
            : data.data;
          setCart(cartInfo);
          if (cartInfo?.orderFormId) setOrderFormId(cartInfo.orderFormId);
          const itemCount = cartInfo?.items?.length || 0;
          const total = cartInfo?.totalizers?.[0]?.value || 0;
          addMessage("assistant", `Your cart has ${itemCount} item(s). Total: ₹${(total / 100).toFixed(2)}. Say 'checkout' to proceed to payment.`);
          break;
        }

        case "login": {
          addMessage("system", "Please login to continue.");
          setActivePanel("login");
          break;
        }

        case "checkout":
        case "proceed_to_checkout": {
          if (!user) {
            addMessage("system", "Please login first to proceed with checkout.");
            setActivePanel("login");
          } else {
            addMessage("system", "Proceeding to payment...");
            setActivePanel("payment");
          }
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

  const handleAddToCart = (skuId: string) => {
    handleSend(`Add to cart SKU: ${skuId}`);
  };

  const handleViewDetails = (skuId: string) => {
    handleSend(`Get SKU details: ${skuId}`);
  };

  const cartTotal = cart?.totalizers?.[0]?.value
    ? cart.totalizers[0].value / 100
    : 0;

  return (
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
            <ChatWindow messages={messages} onSend={handleSend} isLoading={isLoading} />
          )}
          {activePanel === "login" && (
            <LoginPanel
              storeUrl={STORE_URL}
              onLoginSuccess={handleLoginSuccess}
              isEmbedded={false}
            />
          )}
          {activePanel === "payment" && (
            <PaymentPanel
              orderFormId={orderFormId}
              cartTotal={cartTotal}
              onPaymentComplete={handlePaymentComplete}
              storeUrl={STORE_URL}
            />
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
  );
}