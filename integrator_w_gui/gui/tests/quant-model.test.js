import { parameterValue, displayValue, finalFilter } from "../ui/quant/model.js";
function equal(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
Deno.test("QUANT preserves literal text without evaluating R", () => {
  equal(parameterValue({type:"text", label:"filter"}, "system('bad')"), "system('bad')");
  equal(parameterValue({type:"text", label:"filter"}, "^PC 3[0-5]"), "^PC 3[0-5]");
});
Deno.test("QUANT parses numeric and character vectors with explicit NA", () => {
  equal(parameterValue({type:"number",vector:true}, "-5, 1e-9, NA"), [-5, 1e-9, null]);
  equal(parameterValue({type:"text",vector:true}, "SPL, BQC\nTQC"), ["SPL","BQC","TQC"]);
  equal(parameterValue({type:"boolean"}, "false"), false);
  equal(parameterValue({type:"boolean"}, ""), null);
});
Deno.test("QUANT rejects invalid numbers and required blanks", () => {
  for (const value of ["Infinity","bad","1, 2"]) {
    let threw = false; try { parameterValue({type:"number"}, value); } catch { threw = true; }
    if (!threw) throw Error(`Accepted ${value}`);
  }
  let threw = false; try { parameterValue({type:"text",required:true}, ""); } catch { threw = true; }
  if (!threw) throw Error("Accepted missing required input");
  equal(parameterValue({type:"number"}, ""), null);
});
Deno.test("QUANT roundtrips defaults and final QC has no example sample IDs", () => {
  equal(displayValue([1, null, 3]), "1, NA, 3");
  equal(finalFilter["min.rsquare.response"], .8);
  if ("features.to.keep" in finalFilter) throw Error("Tutorial-specific species must not be forced");
});
