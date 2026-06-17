"use client";

import React, { useState } from "react";
import { useClient, ClientDetails as ClientDetailsType } from "@/lib/clientContext";

export default function ClientDetails() {
  const { client, setClient } = useClient();
  const [form, setForm] = useState<ClientDetailsType>(
    (client as ClientDetailsType) ?? {
      email: null,
      firstName: null,
      lastName: null,
      phone: null,
      corporateName: null,
      corporateDocument: null,
      tradeName: "",
      stateInscription: "",
      corporatePhone: "",
      isCorporate: true,
    }
  );

  const update = (k: keyof ClientDetailsType, v: any) => {
    setForm((s) => ({ ...s, [k]: v }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClient(form);
    alert("Client details saved.");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-white rounded shadow">
      <h3 className="text-lg font-semibold">Client details</h3>

      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Email"
          value={form.email ?? ""}
          onChange={(e) => update("email", e.target.value || null)}
          className="border p-2 rounded"
          type="email"
        />
        <input
          placeholder="Phone"
          value={form.phone ?? ""}
          onChange={(e) => update("phone", e.target.value || null)}
          className="border p-2 rounded"
          type="tel"
        />
        <input
          placeholder="First name"
          value={form.firstName ?? ""}
          onChange={(e) => update("firstName", e.target.value || null)}
          className="border p-2 rounded"
        />
        <input
          placeholder="Last name"
          value={form.lastName ?? ""}
          onChange={(e) => update("lastName", e.target.value || null)}
          className="border p-2 rounded"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Corporate name"
          value={form.corporateName ?? ""}
          onChange={(e) => update("corporateName", e.target.value || null)}
          className="border p-2 rounded"
        />
        <input
          placeholder="Corporate document"
          value={form.corporateDocument ?? ""}
          onChange={(e) => update("corporateDocument", e.target.value || null)}
          className="border p-2 rounded"
        />
        <input
          placeholder="Corporate phone"
          value={form.corporatePhone ?? ""}
          onChange={(e) => update("corporatePhone", e.target.value)}
          className="border p-2 rounded"
        />
        <input
          placeholder="Trade name"
          value={form.tradeName ?? ""}
          onChange={(e) => update("tradeName", e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="State inscription"
          value={form.stateInscription ?? ""}
          onChange={(e) => update("stateInscription", e.target.value)}
          className="border p-2 rounded"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!form.isCorporate}
            onChange={(e) => update("isCorporate", e.target.checked)}
          />
          <span>Is corporate</span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button className="px-3 py-2 bg-blue-600 text-white rounded" type="submit">
          Save
        </button>
        <button
          type="button"
          className="px-3 py-2 border rounded"
          onClick={() => {
            setForm({ ...form, ...{
              email: null,
              firstName: null,
              lastName: null,
              phone: null,
              corporateName: null,
              corporateDocument: null,
              tradeName: "",
              stateInscription: "",
              corporatePhone: "",
              isCorporate: true,
            } });
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
