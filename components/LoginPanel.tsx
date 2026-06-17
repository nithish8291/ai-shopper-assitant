"use client";

import { useState } from "react";
import { v4 as uuid } from "uuid";

interface LoginPanelProps {
  storeUrl: string;
  onLoginSuccess: (userData: any) => void;
  isEmbedded?: boolean;
}

export default function LoginPanel({ storeUrl, onLoginSuccess, isEmbedded = false }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showIframe, setShowIframe] = useState(isEmbedded);

  const getSessionId = () => {
    if (typeof window === "undefined") return "server-session";
    let id = localStorage.getItem("shopping-session-id");
    if (!id) {
      id = uuid();
      localStorage.setItem("shopping-session-id", id);
    }
    return id;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "login",
          context: { email, password },
          sessionId: getSessionId()
        }),
      });

      const data = await res.json();

      if (data.success) {
        onLoginSuccess(data.data);
      } else {
        setError(data.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (showIframe) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold">Store Login</h3>
          <button
            onClick={() => setShowIframe(false)}
            className="text-xs text-blue-600 hover:underline"
          >
            Use form instead
          </button>
        </div>
        <iframe
          src={`${storeUrl}/login`}
          className="flex-1 w-full border-0"
          title="VTEX Store Login"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-sm mx-auto">
        <h3 className="text-lg font-semibold mb-1">Sign In</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Login to your VTEX store account to manage orders and checkout.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setShowIframe(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Login via store page instead
          </button>
        </div>
      </div>
    </div>
  );
}
