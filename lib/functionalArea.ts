export type LabelValuePair = { label: string; value: string };

export const FUNCTIONAL_AREA_OPTIONS: LabelValuePair[] = [
  { label: "Administrative / Human Resources", value: "860330000" },
  { label: "Distribution", value: "860330001" },
  { label: "E-Commerce", value: "860330002" },
  { label: "Engineering", value: "860330003" },
  { label: "Executive / General Management", value: "860330004" },
  { label: "Finance / Accounting", value: "860330018" },
  { label: "Information Technology", value: "860330005" },
  { label: "Legal / Compliance / Regulatory", value: "860330006" },
  { label: "Logistics", value: "860330007" },
  { label: "Manufacturing", value: "860330008" },
  { label: "Marketing / Brand Protection / Media", value: "860330009" },
  { label: "Master Data / GS1 Standards (UPC, EDI, GTIN, GDSN) Coordination", value: "860330010" },
  { label: "Medical / Health / Practitioner", value: "860330011" },
  { label: "Operations", value: "860330012" },
  { label: "Packaging", value: "860330013" },
  { label: "Product Management", value: "860330014" },
  { label: "Quality Management / Food Safety", value: "860330015" },
  { label: "Sales", value: "860330016" },
  { label: "Supply Chain", value: "860330017" },
  { label: "Other / Please specify", value: "860330019" },
];

export const FUNCTIONAL_AREA_KEYS: Array<{ keys: string[]; value: string }> = [
  { keys: ["admin", "humanresource", "hr"], value: "860330000" },
  { keys: ["distribution"], value: "860330001" },
  { keys: ["ecommerce", "ecom"], value: "860330002" },
  { keys: ["engineering"], value: "860330003" },
  { keys: ["executive", "generalmanagement"], value: "860330004" },
  { keys: ["finance", "accounting"], value: "860330018" },
  { keys: ["informationtechnology", "it"], value: "860330005" },
  { keys: ["legal", "compliance", "regulatory"], value: "860330006" },
  { keys: ["logistics"], value: "860330007" },
  { keys: ["manufacturing"], value: "860330008" },
  { keys: ["marketing", "brand", "media"], value: "860330009" },
  { keys: ["masterdata", "gs1", "upc", "edi", "gtin", "gdsn"], value: "860330010" },
  { keys: ["medical", "health", "practitioner"], value: "860330011" },
  { keys: ["operations"], value: "860330012" },
  { keys: ["packaging"], value: "860330013" },
  { keys: ["productmanagement"], value: "860330014" },
  { keys: ["quality", "foodsafety"], value: "860330015" },
  { keys: ["sales"], value: "860330016" },
  { keys: ["supplychain"], value: "860330017" },
  { keys: ["other"], value: "860330019" },
];

export function normalizeFunctionalArea(input: string): string {
  const n = input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  if (/^\d+$/.test(n)) {
    return input.trim();
  }

  for (const entry of FUNCTIONAL_AREA_KEYS) {
    if (entry.keys.some((k) => n.includes(k))) {
      return entry.value;
    }
  }

  throw new Error(
    `Unrecognized functional area: "${input}". Please choose from the list.`
  );
}
