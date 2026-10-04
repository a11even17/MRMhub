import { parameterValue, displayValue, finalFilter } from "./model.js";
import { legacySteps, legacyDraftKey, historyForMode } from "./legacy.js";
import { createREditor } from "./r-editor.bundle.js";
import { inspectRPaste, datasetImportCode } from "./paste.js";
import { initializeConsole } from "./console.js";
import { initializeOutput } from "./log.js";
import { createPlotViewer } from "./plot-viewer.js";
import { savedGraphs, chooseGraph } from "./graphs.js";
import { initializeProgress } from "./progress.js";

const native = window.__TAURI__;
const invoke = (...args) => native.core.invoke(...args);
const shell = () => window.__mrmhubShell;
const confirm = (title, message) => shell().confirm(message, title);
let root, path, history = [], allHistory = [], graphs = [], current, catalog = [], selected, ready = false, busy = false;
let table = "dataset", offset = 0, page, changes = new Map(), generation = 0;
const drafts = new Map();
let mode = "guided", legacyStep = 0, legacyDrafts = {}, legacyTrusted = false;
let legacyEditor, output, plotViewer, runProgress;
const $ = id => root.querySelector(`#q-${id}`);
const make = (tag, text, className) => {
  const el = document.createElement(tag); if (text != null) el.textContent = text;
  if (className) el.className = className; return el;
};
const checkpointKey = () => mode === "legacy" ? `mrmhub-quant-legacy-checkpoint:${path}` : `mrmhub-quant-checkpoint:${path}`;
const opName = id => id?.startsWith("legacy-") ? `Step ${Number(id.slice(7)) + 1} · ${legacySteps[Number(id.slice(7))]}` : catalog.find(o => o.id === id)?.label ?? id ?? "Edit metadata";
const trashButton = (id, label, all = false) => `<button id="q-${id}" type="button" class="q-trash" aria-label="${label}" title="${label}" disabled><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>${all ? '<span>All</span>' : ''}</button>`;
function log(text) {
  output.append(text);
}
function setBusy(value, message = "") {
  busy = value;
  $("busy").classList.toggle("hidden", !value);
  $("busy-text").textContent = message;
  $("workspace").disabled = value;
  $("setup").disabled = value;
  $("runtime").disabled = value;
  $("check").disabled = value;
  $("guided-tab").disabled = value;
  $("legacy-tab").disabled = value;
  legacyEditor?.setReadOnly(value);
  $("terminal-state").textContent = value ? "Running" : "Idle";
  $("terminal-state").classList.toggle("running", value);
  root.setAttribute("aria-busy", String(value));
}
async function task(message, fn) {
  if (busy) return;
  setBusy(true, message); $("error").textContent = "";
  try { return await fn(); }
  catch (e) { $("error").textContent = String(e); log(`Error: ${e}`); }
  finally { setBusy(false); updateRun(); }
}
function updateRun() {
  $("run").disabled = busy || !ready || !path || (!current && selected?.kind !== "import");
  $("legacy-run").disabled = busy || !ready || !path || !legacyEditor?.getValue().trim();
  legacyEditor?.setRunnable(!$("legacy-run").disabled);
  $("delete-plot").disabled = busy || !graphs.length;
  $("delete-plots").disabled = busy || !graphs.length;
  $("delete-checkpoint").disabled = busy || !current;
  $("delete-checkpoints").disabled = busy || !allHistory.some(h => (h.action === "legacy") === (mode === "legacy"));
  $("compact").disabled = busy || !path;
}
export async function initializeQuant(projectPath) {
  if (!root) {
    root = document.querySelector("#quant-view");
    root.innerHTML = `
      <section class="q-heading"><div><span class="eyebrow">Quantitation & quality control</span><h1>MRMhub QUANT</h1><p id="q-dataset"></p></div><span class="q-badge">Original R engine</span></section>
      <section class="q-panel q-engine"><div><strong id="q-engine-title">Checking R…</strong><p id="q-engine-detail">R runs in the background. No RStudio or separate plot windows.</p></div><div class="q-actions"><button id="q-check" type="button">Check R</button><button id="q-runtime" type="button">Locate Rscript</button><button id="q-setup" type="button">Set up R dependencies</button></div></section>
      <div id="q-busy" class="q-progress hidden" role="status"><span></span><p id="q-busy-text"></p></div>
      <p id="q-error" class="q-error" role="alert"></p>
      <div class="q-subtabs" role="tablist" aria-label="QUANT workflow mode"><button id="q-guided-tab" type="button" role="tab" aria-selected="true" aria-controls="q-guided-editor">Guided workflow</button><button id="q-legacy-tab" type="button" role="tab" aria-selected="false" aria-controls="q-legacy-editor">Legacy · R code</button></div>
      <fieldset id="q-workspace" class="q-workspace">
        <aside class="q-panel q-stages"><h2>Lipidomics workflow</h2><p id="q-stage-help">Follow the stages in order. Optional checks depend on your data.</p><div id="q-stages"></div><div id="q-legacy-stages" class="hidden"></div><p class="q-help">Steps are optional where your data permits. Required inputs still apply.</p></aside>
        <div class="q-main">
          <section class="q-panel"><div class="q-row"><h2>Analysis checkpoint</h2><div class="q-history-controls"><select id="q-checkpoint" aria-label="Analysis checkpoint"></select>${trashButton("delete-checkpoint", "Delete selected checkpoint")}${trashButton("delete-checkpoints", "Delete all checkpoints in this mode", true)}</div></div><p id="q-summary"></p><p class="q-help">Storage saver: keeps the latest saved session per workflow. After a successful run, older session snapshots are retired; their graphs and exports stay available. Older-version checkpoints remain until you free their storage.</p><button id="q-compact" type="button">Free old session storage…</button></section>
          <section id="q-guided-editor" role="tabpanel" aria-labelledby="q-guided-tab" class="q-panel"><div class="q-row"><h2 id="q-operation-title">Choose an operation</h2><span id="q-operation-kind" class="q-badge"></span></div><p id="q-note"></p><div id="q-import" class="q-form hidden"><label>Experiment title<input id="q-title" type="text" value=""></label><label>Analysis type<select id="q-analysis-type"><option value="lipidomics">Lipidomics</option><option value="metabolomics">Metabolomics</option><option value="externalcalib">External calibration</option><option value="others">Other</option></select></label></div><div id="q-presets" class="q-actions hidden"></div><div id="q-fields" class="q-form"></div><details id="q-advanced"><summary>More settings — original QUANT arguments</summary><div id="q-extra-fields" class="q-form"></div></details><p class="q-help">Checked settings are passed to R. Unchecked settings use the original function default. Lists use commas; NA means missing / no restriction. Blank optional checked values mean NA.</p><button id="q-run" type="button" class="q-primary">Run operation</button></section>
          <section id="q-legacy-editor" role="tabpanel" aria-labelledby="q-legacy-tab" class="q-panel hidden">
            <div class="q-row"><h2 id="q-legacy-title"></h2><button id="q-legacy-new" type="button">New R session</button></div>
            <p>Paste R code from the <a href="https://slinghub.github.io/MRMhub/quant/articles/tutorial-03-lipidomics-workflow.html" target="_blank" rel="noopener noreferrer">original tutorial</a>, then edit paths, sample IDs and settings for your dataset. Printed tables and folder diagrams are examples, not R commands. Nothing runs automatically.</p>
            <p class="q-help">Objects persist between successful blocks. Use <code>mexp</code> for your experiment to show its tables below. Relative paths start in the selected dataset folder; <code>dataset_dir</code> is that folder and <code>output_dir</code> is this run’s output folder. Normal plot output appears below; View() prints in Activity.</p>
            <div class="q-actions"><button id="q-legacy-import" type="button" class="hidden">Insert import for this dataset</button></div>
            <p id="q-legacy-paste-note" class="q-help" role="status"></p>
            <div id="q-legacy-code"></div>
            <p class="q-help">Only run code you trust: R code can read/write files and access the network. Checkpoints cannot undo those side effects. Live connections and background workers are not restored between blocks.</p>
            <button id="q-legacy-run" type="button" class="q-primary">Run code & save session</button>
          </section>
          <section class="q-panel"><div class="q-row"><h2>Data & metadata</h2><select id="q-table-choice" aria-label="Data table"></select></div><p id="q-table-note" class="q-help">Import data to inspect tables.</p><div id="q-table" class="q-table-wrap"></div><div class="q-row"><div class="q-actions"><button id="q-prev" type="button">Previous</button><span id="q-page"></span><button id="q-next" type="button">Next</button></div><div class="q-actions"><button id="q-discard" type="button">Discard edits</button><button id="q-save-edits" type="button" class="q-primary">Save metadata changes</button></div></div></section>
          <section class="q-panel"><div class="q-row"><h2>Graphs & outputs</h2><div class="q-history-controls"><select id="q-plot-choice" aria-label="Saved graphs from all steps"></select>${trashButton("delete-plot", "Delete displayed plot")}${trashButton("delete-plots", "Delete all saved plots", true)}</div></div><p class="q-help">All saved graphs from this dataset’s Guided and Legacy steps. Viewing an earlier graph does not change your analysis checkpoint.</p><button id="q-save-plot" type="button" disabled>Save displayed graph…</button><div id="q-plot"></div><div id="q-files" class="q-files"></div><p id="q-output-path" class="q-help"></p></section>
        </div>
      </fieldset>
      <section class="q-activity q-terminal" aria-label="QUANT activity">
        <div class="q-terminal-bar"><div class="q-actions"><span class="q-terminal-title"><span aria-hidden="true">&gt;_</span> QUANT activity</span>
          <div class="q-console-tabs" role="tablist" aria-label="Activity console">
            <button id="q-r-console-tab" type="button" role="tab" aria-selected="true" aria-controls="q-r-console-panel">R Console</button>
            <button id="q-shell-console-tab" type="button" role="tab" aria-selected="false" aria-controls="q-shell-console-panel" tabindex="-1">Terminal</button>
          </div></div>
          <div class="q-actions"><label id="q-output-colors-label" class="q-output-colors"><input id="q-output-colors" type="checkbox"> Smart colors</label><span id="q-terminal-state" class="q-terminal-state">Idle</span><span id="q-shell-state" class="q-terminal-state hidden">Stopped</span><button id="q-shell-start" type="button" class="hidden">Start session</button><button id="q-clear-log" type="button">Clear</button><button id="q-console-expand" type="button" aria-expanded="false">Expand ⛶</button></div>
        </div>
        <div id="q-r-console-panel" role="tabpanel" aria-labelledby="q-r-console-tab"><pre id="q-log" aria-label="R activity log" tabindex="0"></pre><div id="q-run-progress" role="progressbar" aria-label="Legacy R work progress" aria-valuemin="0" aria-valuemax="100"><pre></pre><div class="q-run-progress-status"></div><small>Completed work units: session load, top-level R statements, session save. Long statements may hold at one percentage.</small></div><div class="q-terminal-foot">R workflow output · stdout / stderr · Run R code in the editor above</div></div>
        <div id="q-shell-console-panel" role="tabpanel" aria-labelledby="q-shell-console-tab" class="hidden"><div id="q-shell-screen" aria-label="Interactive system terminal"></div><div id="q-shell-note" class="q-terminal-foot" role="status">Local shell · Starts in your home folder · Commands have normal access to your files</div></div>
      </section>`;
    legacyEditor = createREditor($("legacy-code"), { onChange: () => { saveLegacyDraft(); updatePasteNote(); updateRun(); }, onRun: runLegacy });
    output = initializeOutput($("log"), $("output-colors"));
    runProgress = initializeProgress(root);
    initializeConsole(root, confirm, () => output.clear());
    plotViewer = createPlotViewer(root);
    $("check").onclick = () => task("Checking R…", checkRuntime);
    $("runtime").onclick = async () => {
      if (!native) return;
      const file = await native.dialog.open({ title: "Choose Rscript (Rscript.exe on Windows)", multiple: false });
      if (file) await task("Checking the selected R runtime…", () => checkRuntime(file));
    };
    $("setup").onclick = async () => {
      if (!await confirm("Download QUANT’s R dependencies?", "This installs packages from CRAN and Bioconductor into an app-owned library and installs this app’s bundled QUANT source. It needs internet access and may take several minutes. Your system R library is not changed.")) return;
      await task("Installing R dependencies — see activity below. Keep the app open.", async () => {
        await invoke("quant_setup"); await checkRuntime();
      });
    };
    $("run").onclick = run;
    $("guided-tab").onclick = () => switchMode("guided");
    $("legacy-tab").onclick = () => switchMode("legacy");
    $("legacy-import").onclick = async () => {
      if (busy) return;
      if (legacyEditor.getValue().trim() && !await confirm("Replace this step’s code?", "Insert an import that reads long.csv from the selected dataset. You can undo this edit in the code editor. Review analysis_type before running.")) return;
      legacyEditor.setValue(datasetImportCode(path)); saveLegacyDraft(); updatePasteNote(); updateRun(); legacyEditor.focus();
    };
    $("legacy-run").onclick = runLegacy;
    $("legacy-new").onclick = () => task("Starting a new R session…", async () => {
      if (!await confirm("Start a new R session?", "This clears the active Legacy session. Your code boxes and saved outputs are kept. The current session snapshot is retired only after a new block succeeds.")) return;
      current = undefined; remember(); await renderResult();
    });
    for (const [index, label] of legacySteps.entries()) {
      const button = make("button", `${index + 1}. ${label}`); button.type = "button"; button.dataset.legacyStep = index;
      button.onclick = () => { chooseLegacyStep(index); $("legacy-title").scrollIntoView({ block: "start" }); };
      $("legacy-stages").append(button);
    }
    chooseLegacyStep(0);
    $("checkpoint").onchange = () => task("Loading checkpoint…", async () => {
      if (!await discardWarning()) { $("checkpoint").value = current?.id ?? ""; return; }
      current = history.find(h => h.id === $("checkpoint").value); remember();
      await renderResult();
    });
    $("table-choice").onchange = () => task("Loading table…", async () => {
      if (!await discardWarning()) { $("table-choice").value = table; return; }
      table = $("table-choice").value; offset = 0; await loadTable();
    });
    $("prev").onclick = () => navigateTable(-50);
    $("next").onclick = () => navigateTable(50);
    $("discard").onclick = () => task("Reloading table…", async () => { if (await discardWarning()) await loadTable(); });
    $("save-edits").onclick = saveEdits;
    $("plot-choice").onchange = () => task("Loading graph…", loadPlot);
    $("delete-plot").onclick = () => deleteHistory("plots", false);
    $("delete-plots").onclick = () => deleteHistory("plots", true);
    $("delete-checkpoint").onclick = () => deleteHistory("checkpoints", false);
    $("delete-checkpoints").onclick = () => deleteHistory("checkpoints", true);
    $("compact").onclick = compactStorage;
    $("save-plot").onclick = () => task("Saving graph…", async () => {
      const graph = graphs.find(g => g.key === $("plot-choice").value);
      if (!graph) return;
      const destination = await native.dialog.save({ defaultPath: graph.name, title: "Save selected QUANT graph" });
      if (destination) await invoke("quant_save_artifact", { project: path, id: graph.id, name: graph.name, destination });
    });
    if (native) await native.event.listen("quant-log", event => log(event.payload));
    if (native) await native.event.listen("quant-progress", event => runProgress.receive(event.payload));
  }
  if (busy) {
    if (projectPath !== path) $("error").textContent = "An analysis for the previous dataset is still running. Reopen QUANT when it finishes to switch datasets.";
    return;
  }
  if (path !== projectPath) {
    if (!await discardWarning()) return;
    path = projectPath; current = undefined; history = []; allHistory = []; graphs = []; offset = 0; generation++;
    loadLegacyDrafts();
    drafts.clear(); selected = undefined;
    $("dataset").textContent = path || "Select a dataset folder in Integrator first. You can then import its long.csv or another results file.";
    $("title").value = path?.split(/[\\/]/).pop() || "Experiment";
    await task("Loading this dataset’s QUANT history…", async () => {
      if (native && path) allHistory = await invoke("quant_history", { project: path });
      history = historyForMode(allHistory, mode);
      let remembered; try { remembered = localStorage.getItem(checkpointKey()); } catch { /* optional */ }
      current = remembered === "" ? undefined : history.find(h => h.id === remembered) ?? history[0];
      await renderResult();
    });
    if (catalog.length) chooseOperation("import_data_mrmhub");
  }
  if (!native) { $("engine-title").textContent = "QUANT runs in the desktop app"; $("setup").disabled = true; return; }
  if (!catalog.length) await task("Checking the R engine…", checkRuntime);
  updateRun();
}
async function deleteHistory(kind, all) {
  await task("Updating saved QUANT history…", async () => {
    const graph = graphs.find(g => g.key === $("plot-choice").value);
    const modeRuns = allHistory.filter(h => (h.action === "legacy") === (mode === "legacy"));
    if (!path || (kind === "plots" ? !graphs.length : !modeRuns.length)) return;
    if (!all && (kind === "plots" ? !graph : !current)) return;
    const label = mode === "legacy" ? "Legacy" : "Guided";
    const selection = kind === "plots"
      ? (all ? `all ${graphs.length} saved plot images from BOTH Guided and Legacy steps` : `the displayed plot “${graph.name}” from ${opName(graph.operation)}`)
      : (all ? `all ${modeRuns.length} ${label} saved runs, including older output-only runs` : `the selected ${label} checkpoint (${opName(current.operation)})`);
    const detail = kind === "plots"
      ? "Analysis sessions, data, PDFs and other non-image exports are kept."
      : `This includes their saved R sessions, data snapshots, graphs and other outputs. ${all ? `The other workflow mode is kept.` : "Other checkpoints are kept."} Any code that explicitly refers to files inside a removed checkpoint will need those files restored.`;
    if (!await confirm(`Delete ${all ? "all" : "selected"} ${kind === "plots" ? "plot" + (all ? "s" : "") : "checkpoint" + (all ? "s" : "")}?`,
      `Move ${selection} to trash for this dataset?\n\n${detail}\n\nItems go to QUANT/.trash with recovery instructions, not permanent deletion. They still use disk space until you use “Free old session storage…” or manually empty that folder. Dataset input files and exports saved elsewhere are untouched.`)) return;
    if (!await discardWarning()) return;
    const oldId = current?.id;
    plotViewer.close();
    try {
      const result = await invoke("quant_delete", { project: path, kind, all, mode,
        id: kind === "plots" ? graph?.id ?? "" : current?.id ?? "", name: graph?.name ?? "" });
      log(`Moved ${result.count} ${kind} to dataset trash.${result.trash ? ` Recovery: ${result.trash}` : ""}`);
    } finally {
      // Also refresh after a partial filesystem failure, so no stale selection
      // can point at an item that was already moved successfully.
      allHistory = await invoke("quant_history", { project: path });
      history = historyForMode(allHistory, mode);
      current = oldId ? history.find(h => h.id === oldId) ?? history[0] : undefined;
      changes.clear(); offset = 0; generation++; remember();
      await renderResult();
    }
  });
}

async function compactStorage() {
  await task("Freeing old QUANT session storage…", async () => {
    if (!path || !await confirm("Permanently free old QUANT storage?",
      "This keeps only the newest resumable session in EACH workflow (Guided and Legacy), permanently removes older automatic session/plot-object snapshots, and empties this dataset’s QUANT/.trash.\n\nEarlier graphs, PDFs, exports, R code and logs outside trash stay available. Input datasets and Integrator results are untouched. Older sessions can no longer be resumed, and trashed items cannot be recovered. Export any session you want to keep first.")) return;
    if (!await discardWarning()) return;
    const oldId = current?.id;
    try {
      await invoke("quant_compact", {project:path});
      log("Old session snapshots and dataset trash cleared permanently. Latest Guided/Legacy sessions and saved outputs kept.");
    } finally {
      allHistory = await invoke("quant_history", {project:path}); history = historyForMode(allHistory, mode);
      current = history.find(h=>h.id===oldId) ?? history[0];
      changes.clear(); offset=0; generation++; remember(); await renderResult();
    }
  });
}

async function checkRuntime(rscript = null) {
  const status = await invoke("quant_status", { rscript });
  ready = status.ready;
  $("engine-title").textContent = ready ? `QUANT ${status.catalog.version} · Ready` : "One-time R setup needed";
  $("engine-detail").textContent = status.message || `${status.rVersion} · ${status.rscript}`;
  $("setup").textContent = ready ? "Repair R dependencies" : "Set up R dependencies";
  if (ready) {
    catalog = status.catalog.operations;
    renderStages(); chooseOperation(selected?.id || "import_data_mrmhub");
    await renderResult();
  }
}
function saveLegacyDraft() {
  legacyDrafts[legacyStep] = legacyEditor.getValue();
  if (!path) return;
  try { localStorage.setItem(legacyDraftKey(path), JSON.stringify(legacyDrafts)); }
  catch { $("error").textContent = "Could not save code drafts locally. Copy your code before closing the app."; }
}
function loadLegacyDrafts() {
  legacyDrafts = {}; legacyStep = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(legacyDraftKey(path)) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) legacyDrafts = saved;
  } catch { /* Keep the editor usable when stored drafts are unavailable. */ }
  chooseLegacyStep(0);
}
function chooseLegacyStep(index) {
  legacyStep = index;
  $("legacy-title").textContent = `${index + 1}. ${legacySteps[index]}`;
  legacyEditor.setValue(typeof legacyDrafts[index] === "string" ? legacyDrafts[index] : "", true);
  $("legacy-import").classList.toggle("hidden", index !== 1);
  updatePasteNote();
  root.querySelectorAll("[data-legacy-step]").forEach(button => button.classList.toggle("active", Number(button.dataset.legacyStep) === index));
  updateRun();
}
async function switchMode(next) {
  if (mode === next) return;
  await task("Loading workflow…", async () => {
    if (!await discardWarning()) return;
    mode = next; offset = 0; generation++; current = undefined; history = [];
    legacyEditor.close();
    const legacy = mode === "legacy";
    $("guided-tab").setAttribute("aria-selected", String(!legacy));
    $("legacy-tab").setAttribute("aria-selected", String(legacy));
    $("guided-editor").classList.toggle("hidden", legacy);
    $("legacy-editor").classList.toggle("hidden", !legacy);
    $("stages").classList.toggle("hidden", legacy);
    $("legacy-stages").classList.toggle("hidden", !legacy);
    $("stage-help").textContent = legacy ? "The original 23 tutorial steps. Select a step, paste code, then run. Skip or revisit steps as needed." : "Follow the stages in order. Optional checks depend on your data.";
    $("save-edits").classList.toggle("hidden", legacy);
    $("discard").classList.toggle("hidden", legacy);
    if (native && path) allHistory = await invoke("quant_history", { project: path });
    history = historyForMode(allHistory, mode);
    let remembered; try { remembered = localStorage.getItem(checkpointKey()); } catch { /* optional */ }
    current = remembered === "" ? undefined : history.find(h => h.id === remembered) ?? history[0];
    await renderResult();
    legacyEditor.refresh();
  });
}
function updatePasteNote() {
  const paste = inspectRPaste(legacyEditor.getValue());
  $("legacy-paste-note").textContent = paste.folderDiagram ? "This contains a folder-layout illustration, not executable R. Start with library(mrmhub), then import your dataset in step 2." : paste.changed ? "Run will automatically comment out recognized tutorial output and remove surrounding R code fences. Commands and paths stay unchanged; Undo restores the paste." : legacyStep === 1 ? "The tutorial’s sPerfect file is an example. Insert an import for this dataset, or change the path to your own results file." : "R syntax highlighting · Ctrl/Cmd+F to find · Recognized tutorial output is cleaned automatically when you Run";
}
async function runLegacy() {
  if (busy || !ready || !path) return;
  const paste = inspectRPaste(legacyEditor.getValue());
  if (paste.folderDiagram) { $("error").textContent = "The pasted folder diagram is documentation, not R code. Run library(mrmhub), then use step 2 to import your dataset."; return; }
  if (!paste.executable) { $("error").textContent = "This paste contains only comments or example output. Paste the R commands above the output, then Run."; return; }
  await task("Running your R code in the background…", async () => {
    if (!legacyTrusted) {
      if (!await confirm("Run trusted R code?", "Legacy runs your code with your user account’s file and network access, like RStudio. It is not sandboxed. Only run code you trust. A failed block keeps the previous session but cannot undo file writes or other side effects.")) return;
      legacyTrusted = true;
    }
    if (paste.changed) {
      legacyEditor.setValue(paste.code); updatePasteNote();
      log(`Automatically cleaned pasted tutorial output: ${paste.outputLines} output line(s) commented${paste.fenced ? "; surrounding R code fence removed" : ""}. R commands unchanged.`);
    }
    saveLegacyDraft();
    const request = { action: "legacy", operation: `legacy-${legacyStep}`, code: legacyEditor.getValue(), checkpoint: current?.id ?? "", progressToken: crypto.randomUUID() };
    log(`Running Legacy step ${legacyStep + 1}: ${legacySteps[legacyStep]}…`);
    runProgress.start(request.progressToken);
    try { await accept(await invoke("quant_execute", { project: path, request })); }
    finally { runProgress.finish(); }
    log("R block completed. Session saved.");
  });
}
function renderStages() {
  $("stages").replaceChildren();
  for (const stage of [...new Set(catalog.map(o => o.stage))].sort()) {
    const box = make("details"); box.open = stage.startsWith("1");
    box.append(make("summary", stage));
    for (const op of catalog.filter(o => o.stage === stage)) {
      const button = make("button", op.label); button.type = "button"; button.dataset.operation = op.id;
      button.onclick = () => {
        chooseOperation(op.id);
        $("operation-title").scrollIntoView({ block: "start" });
      }; box.append(button);
    }
    $("stages").append(box);
  }
}
function stashForm() {
  if (!selected) return;
  const draft = {};
  for (const field of selected.fields) {
    const input = document.getElementById(`q-input-${field.name}`), check = document.getElementById(`q-enable-${field.name}`);
    if (input && check) draft[field.name] = { enabled: check.checked, text: input.value };
  }
  drafts.set(selected.id, draft);
}
function chooseOperation(id, preset) {
  if (!preset) stashForm();
  selected = catalog.find(o => o.id === id) ?? catalog[0];
  if (!selected) return;
  root.querySelectorAll("[data-operation]").forEach(button => {
    const active = button.dataset.operation === selected.id; button.classList.toggle("active", active);
    if (active) button.parentElement.open = true;
  });
  $("operation-title").textContent = selected.label;
  $("operation-kind").textContent = selected.kind;
  $("note").textContent = selected.note || "Uses the bundled QUANT function with the settings below.";
  $("import").classList.toggle("hidden", selected.kind !== "import");
  $("fields").replaceChildren(); $("extra-fields").replaceChildren(); $("presets").replaceChildren();
  $("presets").classList.toggle("hidden", selected.id !== "filter_features_qc");
  if (selected.id === "filter_features_qc") {
    for (const [label, values] of [["Initial QC", { include_qualifier: false, include_istd: true, "min.intensity.median.spl": 200 }], ["Normalization QC", {include_qualifier:false, include_istd:true,"min.intensity.median.spl":1000}], ["Final tutorial QC", finalFilter]]) {
      const button = make("button", label); button.type = "button";
      button.onclick = () => chooseOperation(selected.id, values); $("presets").append(button);
    }
  }
  for (const field of selected.fields) {
    if (selected.kind === "plot" && field.name === "path") continue;
    const draft = preset ? { enabled: field.name in preset, text: displayValue(preset[field.name]) } : drafts.get(selected.id)?.[field.name];
    const box = make("div", null, "q-field");
    const heading = make("div", null, "q-field-heading");
    const toggle = make("input"); toggle.type = "checkbox"; toggle.id = `q-enable-${field.name}`;
    toggle.checked = field.required || (draft?.enabled ?? field.enabled); toggle.disabled = field.required;
    toggle.setAttribute("aria-label", `Use ${field.label}`);
    const label = make("label", field.label + (field.required ? " *" : "")); label.htmlFor = `q-input-${field.name}`;
    label.title = `${field.name} — R default: ${field.original || "required"}`; heading.append(toggle, label);
    const input = make(field.type === "boolean" ? "select" : "input"); input.id = `q-input-${field.name}`;
    if (field.type === "boolean") for (const value of [...(field.value == null && !field.required ? [""] : []), "true", "false"]) { const option = make("option", value === "" ? "Automatic / NA" : value === "true" ? "Yes" : "No"); option.value = value; input.append(option); }
    else { input.type = "text"; input.placeholder = field.required ? "Required" : `Default: ${field.original}`; }
    input.value = draft?.text ?? displayValue(field.value);
    input.disabled = !toggle.checked; toggle.onchange = () => { input.disabled = !toggle.checked; };
    if (field.name === "path") {
      toggle.checked = true; input.disabled = false;
      const actions = make("div", null, "q-actions");
      const browse = make("button", "Choose file…"); browse.type = "button";
      browse.onclick = async () => {
        const file = await native.dialog.open({ multiple: false, title: selected.kind === "import" ? "Choose results file" : "Choose metadata file", filters: [{ name: "Data", extensions: ["csv", "tsv", "xlsx", "txt"] }] });
        if (file) input.value = file;
      };
      actions.append(browse);
      if (selected.id === "import_data_mrmhub") {
        const use = make("button", "Use this dataset’s long.csv"); use.type = "button";
        use.onclick = () => { input.value = `${path}/long.csv`; }; actions.append(use);
        if (!input.value && path) input.value = `${path}/long.csv`;
      }
      box.append(heading, input, actions);
    } else box.append(heading, input);
    if (field.vector) box.append(make("small", "Comma-separated values", "q-help"));
    const primary = field.required || toggle.checked || ["path", "sheet", "qc_types", "ref_qc_types", "variable", "include_feature_filter", "exclude_feature_filter", "ignore_warnings"].includes(field.name);
    $(primary ? "fields" : "extra-fields").append(box);
  }
  $("run").textContent = selected.kind === "plot" ? "Generate graph" : selected.kind === "export" ? "Generate export" : "Run & save checkpoint";
  updateRun();
}
async function discardWarning() {
  if (!changes.size) return true;
  if (!await confirm("Discard unsaved metadata edits?", "Save your metadata changes first to include them in processing, or discard them to continue.")) return false;
  changes.clear(); return true;
}
async function run() {
  await task("Running QUANT in the background…", async () => {
    if (!await discardWarning()) return;
    if (selected.kind === "import" && current && !await confirm("Start a new import?", "This starts a new analysis branch. Previous checkpoints and exports are kept.")) return;
    const parameters = {};
    for (const field of selected.fields) {
      const toggle = document.getElementById(`q-enable-${field.name}`), input = document.getElementById(`q-input-${field.name}`);
      if (toggle?.checked) parameters[field.name] = parameterValue(field, input.value);
    }
    const request = { action: "run", operation: selected.id, parameters, checkpoint: selected.kind === "import" ? "" : current?.id ?? "", title: $("title").value.trim() || "Experiment", analysisType: $("analysis-type").value };
    log(`Running ${selected.label}…`);
    const result = await invoke("quant_execute", { project: path, request });
    await accept(result); log(`${selected.label} completed. Checkpoint saved.`);
  });
}
function remember() { try { localStorage.setItem(checkpointKey(), current?.id ?? ""); } catch { /* optional */ } }
async function accept(result) {
  current = result;
  allHistory = await invoke("quant_history", {project:path}); history = historyForMode(allHistory, mode);
  remember(); changes.clear(); offset = 0;
  await renderResult();
}
function renderHistory() {
  $("checkpoint").replaceChildren();
  if (!current) { const empty = make("option", mode === "legacy" ? "New R session" : "No analysis yet"); empty.value = ""; $("checkpoint").append(empty); }
  for (const h of history) {
    const option = make("option", `${new Date(h.created).toLocaleString()} · ${opName(h.operation)}`); option.value = h.id;
    option.selected = current?.id === h.id; $("checkpoint").append(option);
  }
}
async function renderResult() {
  renderHistory();
  $("summary").textContent = current ? `${current.title} · ${current.samples} samples · ${current.features} features · ${current.normalized ? "ISTD normalized" : "Not normalized"} · ${current.quantitated ? "Quantitated" : "Not quantitated"} · ${current.filtered ? "QC filtered" : "Not filtered"}` : "Import results to begin. All analysis stays local to this dataset.";
  if (mode === "legacy") $("summary").textContent = current ? `Saved R objects: ${[].concat(current.objects ?? []).join(", ") || "none"}. Working directory: ${current.workingDirectory}` : "New Legacy session. Paste library(mrmhub) or your import code to begin. Guided checkpoints are separate.";
  $("table-choice").replaceChildren();
  const tables = current?.tables ?? [];
  if (!tables.some(t => t.name === table)) table = "dataset";
  for (const t of tables) {
    const option = make("option", `${t.name.replaceAll("_", " ")} (${t.rows.toLocaleString()})${t.editable ? " · editable" : ""}`); option.value = t.name; option.selected = table === t.name; $("table-choice").append(option);
  }
  const previousGraph = $("plot-choice").value;
  graphs = savedGraphs(allHistory);
  $("plot-choice").replaceChildren(); $("files").replaceChildren(); $("plot").replaceChildren();
  const groups = new Map();
  for (const graph of graphs) {
    if (!groups.has(graph.id)) {
      const group = make("optgroup"); group.label = `${graph.mode} · ${opName(graph.operation)} · ${new Date(graph.created).toLocaleString()}`;
      groups.set(graph.id, group); $("plot-choice").append(group);
    }
    const option = make("option", graph.name); option.value = graph.key; groups.get(graph.id).append(option);
  }
  $("plot-choice").value = chooseGraph(graphs, current?.id, previousGraph);
  $("plot-choice").disabled = !graphs.length;
  $("save-plot").disabled = !graphs.length;
  for (const a of current?.artifacts ?? []) {
    const button = make("button", `Save ${a.name}…`); button.type = "button";
    button.onclick = () => task("Saving output…", async () => {
      const destination = await native.dialog.save({ defaultPath: a.name, title: "Save QUANT output" });
      if (destination) await invoke("quant_save_artifact", { project: path, id: current.id, name: a.name, destination });
    }); $("files").append(button);
  }
  $("output-path").textContent = current ? `Saved in ${current.directory}. ${mode === "legacy" ? "workspace.rds preserves your R objects; code.R records the executed code. Explicit export paths are respected; use output_dir to collect exports here." : "RDS preserves the full-precision experiment; request.json and session-info.txt record the settings and R environment."}` : "Graphs and exports appear here after their operation completes.";
  if (ready && current && tables.length) await loadTable(); else renderTable(null);
  await loadPlot(); updateRun();
}
async function loadPlot() {
  const graph = graphs.find(g => g.key === $("plot-choice").value); $("plot").replaceChildren();
  if (!graph) return;
  const project = path;
  const image = make("img"); image.alt = `${graph.mode} · ${opName(graph.operation)} — ${graph.name}`;
  image.src = await invoke("quant_image", { project, id: graph.id, name: graph.name });
  if (project !== path || graph.key !== $("plot-choice").value) return;
  const button = make("button", null, "q-plot-open"); button.type = "button";
  button.setAttribute("aria-label", `Enlarge ${image.alt}`);
  button.title = "Open full-resolution plot · Zoom and pan";
  button.append(image); button.onclick = () => plotViewer.open(image.src, image.alt);
  $("plot").append(button, make("p", `${graph.mode} · ${opName(graph.operation)} · ${new Date(graph.created).toLocaleString()}. Click to enlarge, zoom and pan.`, "q-help"));
}
async function loadTable() {
  if (!current) return renderTable(null);
  const token = generation;
  const result = await invoke("quant_execute", { project: path, request: { action: "table", checkpoint: current.id, table, offset, limit: 50 } });
  if (token === generation) { changes.clear(); renderTable(mode === "legacy" ? { ...result, editable: false } : result); }
}
function renderTable(data) {
  page = data; $("table").replaceChildren();
  $("prev").disabled = !data || offset === 0; $("next").disabled = !data || offset + 50 >= data.total;
  $("page").textContent = data ? `${data.total ? offset + 1 : 0}–${Math.min(offset + 50, data.total)} of ${data.total.toLocaleString()}` : "";
  $("save-edits").disabled = true; $("discard").disabled = true;
  $("table-note").textContent = data?.editable ? "Edit cells, then save to validate with QUANT’s original metadata importer. Clear a cell to mark it missing. Metadata edits reset downstream processing; rerun those steps afterwards. Import a table/workbook to add columns or rows." : "Read-only measurements / results. Edit annotations using the metadata tables; imported measurements remain unchanged.";
  if (mode === "legacy") $("table-note").textContent = data ? "Read-only preview of mexp. Make changes using your R code above." : "Create or import an MRMhubExperiment named mexp to browse its tables here. Other printed results appear in Activity.";
  if (!data) return;
  const grid = make("table"), head = make("thead"), tr = make("tr"), body = make("tbody");
  for (const name of data.columns) { const cell = make("th", name); cell.scope = "col"; tr.append(cell); }
  head.append(tr); grid.append(head, body);
  for (const [i, row] of data.rows.entries()) {
    const line = make("tr");
    for (const col of data.columns) {
      const cell = make("td");
      if (data.editable) {
        const input = make("input"); input.type = "text"; input.value = displayValue(row[col]); input.placeholder = "NA";
        input.setAttribute("aria-label", `${col}, row ${offset + i + 1}`);
        input.oninput = () => {
          const key = `${offset + i}:${col}`;
          if (input.value === displayValue(row[col])) changes.delete(key);
          else changes.set(key, { row: offset + i, column: col, value: input.value === "" ? null : input.value });
          input.classList.toggle("q-changed", changes.has(key));
          $("save-edits").disabled = !changes.size; $("discard").disabled = !changes.size;
        }; cell.append(input);
      } else cell.textContent = displayValue(row[col]) || "—";
      line.append(cell);
    }
    body.append(line);
  }
  $("table").append(grid);
}
async function navigateTable(delta) {
  await task("Loading table…", async () => {
    if (!await discardWarning()) return;
    offset = Math.max(0, offset + delta); await loadTable();
  });
}
async function saveEdits() {
  if (!changes.size) return;
  if (!await confirm("Save metadata and reset downstream processing?", "QUANT will revalidate and relink the annotations. Rerun normalization, quantitation, corrections, and filtering afterwards. On success this replaces the previous session snapshot; saved outputs are kept.")) return;
  await task("Validating metadata…", async () => {
    const result = await invoke("quant_execute", { project: path, request: { action: "edit", checkpoint: current.id, table, changes: [...changes.values()] } });
    await accept(result);
  });
}
