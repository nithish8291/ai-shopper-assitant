"use client";

import React from "react";
import { useFormContext } from "react-hook-form";

const METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "ach", label: "ACH" },
  { value: "invoice", label: "Invoice" },
  { value: "wire", label: "Wire Transfer" },
];

export default function PaymentMethods() {
  const { register } = useFormContext();

  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">Payment method</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <label key={m.value} className="flex items-center gap-2 p-2 border rounded">
            <input type="radio" value={m.value} {...register("paymentMethod")} />
            <span>{m.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
