import { LabelValuePair } from "./functionalArea";

export const JOB_TITLE_OPTIONS: LabelValuePair[] = [
  { label: "C-Level / Executive / SVP-Level", value: "860330000" },
  { label: "President / Owner / Partner / General Manager", value: "860330001" },
  { label: "VP-Level", value: "860330002" },
  { label: "Manager", value: "860330003" },
  { label: "Account Executive", value: "860330004" },
  { label: "Analyst / Specialist", value: "860330005" },
  { label: "Director", value: "860330006" },
  { label: "Administrative Assistant", value: "860330007" },
];

export const JOB_TITLE_KEYS: Array<{ keys: string[]; value: string }> = [
  { keys: ["clevel", "executive", "svp"], value: "860330000" },
  { keys: ["president", "owner", "partner", "generalmanager"], value: "860330001" },
  { keys: ["vplevel", "vp"], value: "860330002" },
  { keys: ["manager"], value: "860330003" },
  { keys: ["accountexecutive"], value: "860330004" },
  { keys: ["analyst", "specialist"], value: "860330005" },
  { keys: ["director"], value: "860330006" },
  { keys: ["administrativeassistant", "admin"], value: "860330007" },
];

export function normalizeJobTitle(input: string): string {
  const n = input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  if (/^\d+$/.test(n)) {
    return input.trim();
  }

  for (const entry of JOB_TITLE_KEYS) {
    if (entry.keys.some((k) => n.includes(k))) {
      return entry.value;
    }
  }

  throw new Error(`Unrecognized job title: "${input}". Please choose from the list.`);
}
