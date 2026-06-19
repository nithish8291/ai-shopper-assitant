"use client";

import React, { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Country, State } from "country-state-city";

export type AddressShape = {
  addressLine: string | null;
  addressLineSecond: string | null;
  number: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  countryFullName: string | null;
  stateVtexValue: string | null;
  ext: string | null;
};

type Props = {
  name: string; // field name prefix (e.g. "companyAddress" or "orderAddress")
  readOnly?: boolean;
};

export default function AddressForm({ name, readOnly = false }: Props) {
  const { register, watch, setValue } = useFormContext();

  const country = watch(`${name}.country`) as string | undefined;

  const countryList = useMemo(() => Country.getAllCountries(), []);

  const states = useMemo(() => {
    if (!country) return [];
    return State.getStatesOfCountry(country);
  }, [country]);

  // Keep derived fields in sync
  React.useEffect(() => {
    if (!country) {
      setValue(`${name}.countryFullName`, "");
      setValue(`${name}.stateVtexValue`, "");
      return;
    }
    const c = countryList.find((x) => x.isoCode === country);
    setValue(`${name}.countryFullName`, c ? c.name : "");
  }, [country, countryList, name, setValue]);

  return (
    <div className="bg-white rounded p-3 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          {...register(`${name}.addressLine`)}
          placeholder="Address line"
          readOnly={readOnly}
          className="border rounded p-2"
        />
        <input
          {...register(`${name}.addressLineSecond`)}
          placeholder="Address line 2"
          readOnly={readOnly}
          className="border rounded p-2"
        />
        <input
          {...register(`${name}.number`)}
          placeholder="Number"
          readOnly={readOnly}
          className="border rounded p-2"
        />
        <input
          {...register(`${name}.city`)}
          placeholder="City"
          readOnly={readOnly}
          className="border rounded p-2"
        />
        <select
          {...register(`${name}.country`)}
          className="border rounded p-2"
          defaultValue=""
          disabled={readOnly}
        >
          <option value="">Select country</option>
          {countryList.map((c) => (
            <option key={c.isoCode} value={c.isoCode}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          {...register(`${name}.state`)}
          className="border rounded p-2"
          defaultValue=""
          disabled={readOnly || states.length === 0}
        >
          <option value="">Select state</option>
          {states.map((s) => (
            <option key={s.isoCode} value={s.isoCode}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          {...register(`${name}.postalCode`)}
          placeholder="Postal code"
          readOnly={readOnly}
          className="border rounded p-2"
        />
        <input
          {...register(`${name}.ext`)}
          placeholder="Ext"
          readOnly={readOnly}
          className="border rounded p-2"
        />
      </div>
    </div>
  );
}
