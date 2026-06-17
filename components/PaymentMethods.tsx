"use client";

import React, { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { groupPaymentSystems } from "@/lib/paymentUtils";

const FALLBACK_METHODS = ["credit_card", "ach", "invoice", "wire"];
  
export default function PaymentMethods() {
  const { register } = useFormContext();
  const [methods, setMethods] = useState<Array<any>>([]);

  useEffect(() => {
    async function load() {
      try {
        const sessionId = localStorage.getItem("shopping-session-id");
        if (!sessionId) throw new Error("no session id");
        const res = await fetch(`/api/orderform?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error("no orderform");
        const of = await res.json();
        console.log(of.orderForm.response);
        const groups : any = groupPaymentSystems(of?.orderForm?.response);
        console.log(groups);
        if (groups.length === 0) setMethods(FALLBACK_METHODS);
        else setMethods(groups);
      } catch (e) {
        setMethods(FALLBACK_METHODS);
      }
    }
    load();
  }, []);

  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">Payment method</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(methods.length ? methods : FALLBACK_METHODS).map((m) => (
          <label key={m} className="flex items-center gap-2 p-2 border rounded">
            <input type="radio" value={m} {...register("paymentMethod")} />
            <span>{m}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
