// Pure form conversion: no R expressions, eval, or silent numeric coercion.
export function parameterValue(field, text) {
  if (field.type === "boolean") {
    if (text === "" || text === "NA" || text == null) {
      if (field.required) throw new Error(`${field.label} is required.`);
      return null;
    }
    if (text === true || text === "true") return true;
    if (text === false || text === "false") return false;
    throw new Error(`${field.label}: choose Yes or No.`);
  }
  const value = String(text).trim();
  if (!value) {
    if (field.required) throw new Error(`${field.label} is required.`);
    return null; // Explicit R NA; an unchecked field is omitted instead.
  }
  const values = field.vector ? value.split(/\r?\n|,/).map(v => v.trim()) : [value];
  const converted = values.map(v => {
    if (v === "NA") return null;
    if (field.type !== "number") return v;
    if (!v || !Number.isFinite(Number(v))) throw new Error(`${field.label}: enter a finite number (or NA).`);
    return Number(v);
  });
  return field.vector ? converted : converted[0];
}
export function displayValue(value) {
  if (value == null) return "";
  return Array.isArray(value) ? value.map(v => v == null ? "NA" : String(v)).join(", ") : String(value);
}
export const finalFilter = {
  clear_existing: true, use_batch_medians: true,
  include_qualifier: false, include_istd: false,
  "response.curves.selection": [1, 2], "response.curves.summary": "mean",
  "min.rsquare.response": .8, "min.slope.response": .75,
  "max.yintercept.response": .5, "min.signalblank.median.spl.pblk": 10,
  "min.intensity.median.spl": 100, "max.cv.conc.bqc": 25,
};
