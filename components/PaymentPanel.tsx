"use client";

import { useState } from "react";

interface PaymentPanelProps {
  orderFormId: string;
  cartTotal: number;
  onPaymentComplete: (result: any) => void;
  storeUrl: string;
}

export default function PaymentPanel({
  orderFormId,
  cartTotal,
  onPaymentComplete,
  storeUrl,
}: PaymentPanelProps) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "embed">("card");
  const [cardData, setCardData] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "checkout",
          context: {
            orderFormId,
            paymentData: {
              paymentMethod: "credit_card",
              cardNumber: cardData.number.replace(/\s/g, ""),
              cardHolder: cardData.name,
              expiryDate: cardData.expiry,
              cvv: cardData.cvv,
            },
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        onPaymentComplete(data.data);
      } else {
        setError(data.error || "Payment failed. Please try again.");
      }
    } catch (err) {
      setError("Payment processing error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentMethod === "embed") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold">Secure Checkout</h3>
          <button
            onClick={() => setPaymentMethod("card")}
            className="text-xs text-blue-600 hover:underline"
          >
            Use form instead
          </button>
        </div>
        <iframe
          src={`${storeUrl}/checkout/#/payment`}
          className="flex-1 w-full border-0"
          title="VTEX Checkout"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Payment</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total: ₹{cartTotal.toFixed(2)}
            </p>
          </div>
          <div className="px-3 py-1 bg-green-100 dark:bg-green-900 rounded-full">
            <span className="text-xs text-green-700 dark:text-green-300 font-medium">
              🔒 Secure
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Card Number</label>
            <input
              type="text"
              value={cardData.number}
              onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
              placeholder="4111 1111 1111 1111"
              maxLength={19}
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cardholder Name</label>
            <input
              type="text"
              value={cardData.name}
              onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
              placeholder="John Doe"
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Expiry</label>
              <input
                type="text"
                value={cardData.expiry}
                onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                placeholder="MM/YY"
                maxLength={5}
                required
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CVV</label>
              <input
                type="text"
                value={cardData.cvv}
                onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                placeholder="123"
                maxLength={4}
                required
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? "Processing..." : `Pay ₹${cartTotal.toFixed(2)}`}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setPaymentMethod("embed")}
            className="text-xs text-blue-600 hover:underline"
          >
            Use store checkout page instead
          </button>
        </div>
      </div>
    </div>
  );
}
