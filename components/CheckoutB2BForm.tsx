"use client";

import React, { useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AddressForm, { AddressShape } from "@/components/AddressForm";
import OrderAddressSection from "@/components/OrderAddressSection";
import PaymentMethods from "@/components/PaymentMethods";
import { useClient } from "@/lib/clientContext";
import { FUNCTIONAL_AREA_OPTIONS } from "@/lib/functionalArea";
import { JOB_TITLE_OPTIONS } from "@/lib/jobTitle";

const AddressSchema = z.object({
  addressLine: z.string().nullable(),
  addressLineSecond: z.string().nullable(),
  number: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryFullName: z.string().nullable(),
  stateVtexValue: z.string().nullable(),
  ext: z.string().nullable(),
});

const Schema = z.object({
  customer: z.any().nullable(),
  companyAddress: AddressSchema,
  orderAddressSameAsCompany: z.boolean().optional(),
  orderAddress: AddressSchema,
  functionalArea: z.string().nullable(),
  jobTitle: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  selectedSla: z.string().nullable(),
  selectedDeliveryChannel: z.string().nullable(),
  contactPersonId: z.string().nullable(),
  entityGln: z.string().nullable(),
  phoneNumberExt: z.string().nullable(),
  companyTaxExempt: z.boolean().nullable(),
  companyPhoneNumber: z.string().nullable(),
});

type FormValues = z.infer<typeof Schema>;

export default function CheckoutB2BForm({ onSubmit }: { onSubmit?: (data: FormValues) => void }) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      customer: null,
      companyAddress: {
        addressLine: null,
        addressLineSecond: null,
        number: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        countryFullName: null,
        stateVtexValue: null,
        ext: null,
      },
      orderAddressSameAsCompany: false,
      orderAddress: {
        addressLine: null,
        addressLineSecond: null,
        number: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        countryFullName: null,
        stateVtexValue: null,
        ext: null,
      },
      functionalArea: null,
      jobTitle: null,
      paymentMethod: null,
      selectedSla: null,
      selectedDeliveryChannel: null,
      contactPersonId: null,
      entityGln: null,
      phoneNumberExt: null,
      companyTaxExempt: null,
      companyPhoneNumber: null,
    },
  });

  const { handleSubmit, register, setValue } = methods;
  const client = useClient();

  const functionalOptions = useMemo(() => FUNCTIONAL_AREA_OPTIONS, []);
  const jobOptions = useMemo(() => JOB_TITLE_OPTIONS, []);

  const submit = async (data: FormValues) => {
    // attach client.customer if available
    if (client?.client) data.customer = client.client;

    // Enrich delivery selections from cached orderForm if missing
    try {
      if (!data.selectedDeliveryChannel || !data.selectedSla) {
        const sessionId = typeof window !== "undefined" ? localStorage.getItem("shopping-session-id") : null;
        if (sessionId) {
          const res = await fetch(`/api/orderform?sessionId=${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const body = await res.json();
            const of = body?.orderForm ?? body;
            const orderForm = of?.response ?? of;
            const logistics = orderForm?.shippingData?.logisticsInfo;
            const first = Array.isArray(logistics) && logistics.length > 0 ? logistics[0] : null;
            if (first) {
              if (!data.selectedDeliveryChannel && first.selectedDeliveryChannel) {
                data.selectedDeliveryChannel = first.selectedDeliveryChannel;
                setValue("selectedDeliveryChannel", first.selectedDeliveryChannel);
              }
              if (!data.selectedSla && first.selectedSla) {
                data.selectedSla = first.selectedSla;
                setValue("selectedSla", first.selectedSla);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to enrich checkout form from orderForm:", err);
    }

    console.log("B2B form result:", data);
    onSubmit?.(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4 p-4">
        <h2 className="text-xl font-semibold">Company address</h2>
        <AddressForm name="companyAddress" />

        <h2 className="text-xl font-semibold">Order address</h2>
        <OrderAddressSection />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex flex-col">
            <span className="text-sm">Functional area</span>
            <select {...register("functionalArea")} className="border rounded p-2">
              <option value="">Select functional area</option>
              {functionalOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Job title</span>
            <select {...register("jobTitle")} className="border rounded p-2">
              <option value="">Select job title</option>
              {jobOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <PaymentMethods />

        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Submit</button>
          <button type="button" className="px-4 py-2 border rounded" onClick={() => methods.reset()}>
            Reset
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
