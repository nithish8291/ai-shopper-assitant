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
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

const AddressSchema = z.object({
  addressLine: z.string(),
  addressLineSecond: z.string(),
  number: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  postalCode: z.string(),
  countryFullName: z.string(),
  stateVtexValue: z.string(),
  ext: z.string(),
});

const Schema = z.object({
  customer: z.any(),
  companyAddress: AddressSchema,
  orderAddressSameAsCompany: z.boolean().optional(),
  orderAddress: AddressSchema,
  functionalArea: z.string(),
  jobTitle: z.string(),
  paymentMethod: z.string(),
  selectedSla: z.string(),
  selectedDeliveryChannel: z.string(),
  contactPersonId: z.string(),
  entityGln: z.string(),
  phoneNumberExt: z.string(),
  companyTaxExempt: z.boolean(),
  companyPhoneNumber: z.string(),
});

type FormValues = z.infer<typeof Schema>;

export default function CheckoutB2BForm({ onSubmit }: { onSubmit?: (data: FormValues) => void }) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      customer: null,
      companyAddress: {
        addressLine: "",
        addressLineSecond: "",
        number: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        countryFullName: "",
        stateVtexValue: "",
        ext: "",
      },
      orderAddressSameAsCompany: false,
      orderAddress: {
        addressLine: "",
        addressLineSecond: "",
        number: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        countryFullName: "",
        stateVtexValue: "",
        ext: "",
      },
      functionalArea: "",
      jobTitle: "",
      paymentMethod: "",
      selectedSla: "",
      selectedDeliveryChannel: "",
      contactPersonId: "",
      entityGln: "",
      phoneNumberExt: "",
      companyTaxExempt: false,
      companyPhoneNumber: "",
    },
  });

  const { handleSubmit, register, setValue } = methods;
  const client = useClient();

  const functionalOptions = useMemo(() => FUNCTIONAL_AREA_OPTIONS, []);
  const jobOptions = useMemo(() => JOB_TITLE_OPTIONS, []);

  const submit = async (data: FormValues) => {
    console.log("------------------");
    
    // attach client.customer if available
    if (client?.client) data.customer = client.client;

    if(data?.companyAddress?.country) data.companyAddress.country =  countries.alpha2ToAlpha3(data.companyAddress.country) || ""
    
    if(data?.orderAddress?.country) data.orderAddress.country =  countries.alpha2ToAlpha3(data.orderAddress.country) || ""
    
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
    console.log("CheckoutB2BForm: calling onSubmit?", !!onSubmit);
    try {
      onSubmit?.(data);
    } catch (err) {
      console.error("Error while calling onSubmit prop:", err);
    }
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
