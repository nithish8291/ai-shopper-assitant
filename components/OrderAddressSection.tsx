"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import AddressForm from "@/components/AddressForm";

type Props = {
  companyPrefix?: string;
  orderPrefix?: string;
};

export default function OrderAddressSection({ companyPrefix = "companyAddress", orderPrefix = "orderAddress" }: Props) {
  const { watch, getValues, setValue, register } = useFormContext();

  const same = watch("orderAddressSameAsCompany");

  const copyFromCompany = () => {
    const company = getValues(companyPrefix);
    setValue(orderPrefix, company);
  };

  React.useEffect(() => {
    if (same) copyFromCompany();
  }, [same]);

  const company = getValues(companyPrefix);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" {...register("orderAddressSameAsCompany")} />
        <span>Order address is same as company address</span>
      </label>

      {same ? (
        <div className="border rounded p-3 bg-gray-50">
          <div className="text-sm font-medium">Order address</div>
          <div className="text-sm mt-2">
            <div>{company?.addressLine}</div>
            <div>{company?.addressLineSecond}</div>
            <div>{company?.city}, {company?.state}</div>
            <div>{company?.countryFullName} {company?.postalCode}</div>
          </div>
        </div>
      ) : (
        <AddressForm name={orderPrefix} />
      )}
    </div>
  );
}
