import { legacySteps, legacyDraftKey, historyForMode } from "../ui/quant/legacy.js";
Deno.test("Legacy follows all 23 original tutorial steps", () => {
  if (legacySteps.length !== 23 || legacySteps[13] !== "Normalization and quantification based on ISTDs" || legacySteps[22] !== "Sharing the MRMhubExperiment dataset") throw Error("Tutorial steps changed");
});
Deno.test("Legacy histories and drafts are separate from Guided and other datasets", () => {
  const history = [{id:"old", action:"run"}, {id:"manual", action:"legacy"}, {id:"edited", action:"edit"}];
  if (historyForMode(history, "legacy").map(x => x.id).join() !== "manual") throw Error("Wrong Legacy history");
  if (historyForMode(history, "guided").map(x => x.id).join() !== "old,edited") throw Error("Wrong Guided history");
  if (legacyDraftKey("/one/ASSAY") === legacyDraftKey("/two/ASSAY")) throw Error("Drafts overlap");
});
Deno.test("Output-only history remains archived but cannot be selected as a resumable session", () => {
  const history = [{id:"old",action:"legacy",resumable:false}, {id:"latest",action:"legacy",resumable:true}, {id:"prior-version",action:"run"}];
  if (historyForMode(history,"legacy").map(h=>h.id).join()!=="latest") throw Error("Archived session is still selectable");
  if (historyForMode(history,"guided").map(h=>h.id).join()!=="prior-version") throw Error("Old version support changed");
  if(history.length!==3) throw Error("Graph archive was mutated");
});
