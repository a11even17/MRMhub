# QUANT in the desktop GUI

The QUANT tab follows the [lipidomics tutorial](https://slinghub.github.io/MRMhub/quant/articles/tutorial-03-lipidomics-workflow.html). It calls the R functions from **this repository's source**, not a JavaScript/Rust translation and not an arbitrary installed version of `mrmhub`. No scientific source files under `R/` are changed by the GUI adapter.

## First use

1. Install R (4.1 or newer; use a version supported by current CRAN and Bioconductor). RStudio is not required. Standard macOS, Windows, and Linux Rscript locations are searched; **Locate Rscript** handles custom installations.
2. Open **QUANT → Set up R dependencies**. This downloads dependencies from CRAN and the lipid parser from [Bioconductor](https://github.com/lifs-tools/rgoslin#installation), then installs the bundled QUANT package into an app-owned library. Allow several minutes. No system R library is changed. Source-only dependencies may require Rtools on Windows or compiler/system libraries on Linux/macOS; installation errors appear in the activity panel.
3. Select a dataset folder in Integrator. In QUANT, choose **Import MRMhub results → Use this dataset's long.csv** (Step 3 must have produced it), or browse to a different result export. Choose the correct analysis type; ASSAY is not a lipidomics experiment.
4. Import annotation workbooks/tables, or edit existing metadata cells in **Data & metadata** and save. Template exports are available under **Annotate**. Import a file to add metadata rows/columns. Individual workbook table imports accept a sheet name.
5. Work through the inspection, QC/interference, ISTD normalization/quantitation, drift/batch correction, and final QC/export stages. Select plot operations again after processing to compare before/after checkpoints. The feature-QC panel provides initial, normalization-QC, and final-tutorial presets.

Checked settings are explicitly passed to the original function. Unchecked settings use its original default. Required settings cannot be disabled. Lists accept comma-separated values; `NA` represents a missing value/no restriction where supported by the R function. Advanced settings expose the original named arguments without accepting R code.

## Legacy R-code mode

Choose **QUANT → Legacy · R code** for the original tutorial's 23-step layout. Select any step, paste its R block, edit paths/IDs for your dataset, and click **Run code & save session**. Recognized tutorial output copied along with the code is cleaned automatically as described below. No blocks are automatically filled or executed without clicking Run; steps can be skipped and revisited. The same bundled `mrmhub` package is loaded, with no rewriting of your calculations.

The offline R editor provides syntax colors in both themes, line numbers, indentation, bracket matching, undo/redo and Ctrl/Cmd+F search. **Expand** opens the same editor in a large, independently scrollable focus view; Collapse or Escape returns without losing edits. **Run automatically cleans recognized pasted tutorial output and executes in the same click**, with no separate cleanup button or cleanup confirmation. This applies across all Legacy steps: typed tibble printouts, metadata-validation tables, checkmark/info messages, and the guide's known drift/QC warning formats. A complete surrounding R Markdown fence is removed too. Output is commented out in the editor (not silently discarded), the cleanup is logged in Activity, and Undo restores the paste. R commands, sample IDs, paths, strings, and scientific calculations are unchanged. Unknown output is left intact rather than guessed at; folder diagrams and output-only pastes are rejected. The separate first-use trusted-R-code confirmation still applies.

Step 2's **Insert import for this dataset** writes editable code to read `file.path(dataset_dir, "long.csv")`. The tutorial's `datasets/sPerfect_MRMhub.tsv` and metadata paths refer to its example study and will not exist in most selected datasets. Review `analysis_type`, run the import successfully, then continue to step 3. Activity's **R Console** displays the workflow's actual R stdout/stderr; use the R editor above for workflow code.

### Interactive Terminal

While a Legacy block runs, the expanded **R Console** shows a terminal-style progress bar, one-decimal percentage and the current R statement/status. The percentage counts session loading, completed top-level R statements and session saving—not elapsed time or work inside a long-running function. A slowly looping `#` moves only through the filled `=` section (hidden when empty). This is a visual activity indicator, not a measurement of R's responsiveness; reduced-motion preferences disable that animation. The indicator disappears on completion/error and stays hidden in compact view. Expanding/collapsing preserves the page position and the console's reading position (or follows the bottom when already there).

**Smart colors** on the R Console is off by default and remembered locally across launches. It highlights recognized errors in red, warnings in amber, information in blue, and success messages in green; ordinary output stays neutral. This is a display-only heuristic, not a validation of the analysis, and does not alter/censor output. **Expand** on either console fills the app window; Collapse or Escape returns to the normal layout without clearing output or restarting the terminal.

Activity has borderless **R Console** and **Terminal** tabs. The latter starts a real local pseudo-terminal only when requested, after a first-use warning. macOS/Linux use the configured `$SHELL` (falling back to the account's login shell), with normal login startup files. Windows uses PowerShell 7 when installed, otherwise built-in Windows PowerShell, through ConPTY (Windows 10 1809 or newer). No separate console window is launched. Each new shell starts in the user's home directory, not the dataset, app resources, or build directory; user shell profiles can customize that startup directory as in a regular terminal.

The R Console uses compact single-newline output in both color modes: empty/whitespace-only lines are hidden, including progress-message separators. Indentation and spaces within nonempty lines are preserved. This display-only formatting does not change R calculations, exported data, or saved `run.log` files.

Typing, paste, ANSI colors, history, `cd`, interactive programs, Ctrl+C, and terminal resizing are supported. Drag the terminal's lower edge to resize it. Switching tabs/datasets keeps the shell running in its current directory. **Clear** clears the display/scrollback, not files or shell history. **End session** closes the shell after confirmation; **Start session** starts fresh in the home directory. Closing the app ends its terminal session. Programs deliberately detached from the terminal may outlive it, as with a normal terminal app.

This is **not a sandbox**: commands run with the user's normal filesystem/network permissions. It is separate from QUANT's R checkpoints: running `R` here does not attach to `mexp`, save checkpoints, or populate QUANT graphs. R workflow output continues to collect in the R Console while Terminal is selected. Shell output is streamed through a bounded, acknowledged channel (raw UTF-8 bytes), not saved into QUANT analysis logs. Browser previews cannot execute a shell. Unix PTY behavior is covered by native tests; Windows still needs an on-device PowerShell smoke test.

Successful blocks preserve serializable R objects, user-defined functions, attached packages, working directory, and random-number state for the next block. Each block runs in a new background R process: live connections, background workers, arbitrary R options, and external process state are not persisted. Keep the experiment in `mexp` (as in the tutorial) to browse its tables in the GUI. Edit it using code in Legacy; Guided's metadata editor is separate. Each dataset has separate Guided/Legacy histories and locally saved code drafts. **New R session** starts fresh without deleting saved outputs; its first successful block replaces the previous Legacy session snapshot.

Relative paths initially resolve against the selected dataset folder. `dataset_dir` contains that path; `output_dir` points to the new checkpoint's output folder on each run. For example, import `file.path(dataset_dir, "long.csv")` and export to `file.path(output_dir, "results.csv")`. Explicit paths are respected, not redirected. Ordinary base/ggplot output is captured as PNG pages in the GUI; explicitly exported PDFs remain at the paths in your code. `View()` prints to Activity instead of opening another window. Interactive RStudio/Quarto controls are not supported.

**Only execute trusted code.** Legacy is an R notebook runner, not a security sandbox. Code has your account's filesystem/network access and may overwrite files if instructed. Failure preserves the previous saved session, but cannot undo filesystem, network, or other external side effects. Do not explicitly launch graphics windows if you want all output in the GUI. `code.R`, `session-info.txt`, and logs record each successful run; only the latest run keeps its automatic `workspace.rds`. Exports placed directly inside `output_dir` are offered as downloadable artifacts.

## Data requirements and fidelity

- Tutorial values are starting points, **not a validated recipe for every experiment**. No tutorial-specific sample or feature IDs are forced on other datasets. Select QC types and thresholds appropriate to your data.
- ISTD normalization needs valid feature-to-standard mappings and measured standard peaks. Quantitation also needs standard concentrations, sample amounts/units, and standard volumes. Response filters need response-curve annotations. Lipid-specific plots are only meaningful for lipidomics data.
- QUANT's original validations, warnings, numerical methods, and exports are preserved. Invalid inputs fail visibly; missing annotations are not invented. Metadata edits are validated through the original import functions and reset downstream calculations; rerun those calculations.
- R runs without a console window on Windows. All graphics use file devices rather than Quartz/X11/Windows plot windows. Guided plots are retained as PNGs and PDFs, without an additional serialized plot-object copy. Rendering/fonts can differ between operating systems even when numerical results are identical.
- Original import files are read, never rewritten by analysis. Tables are paginated for display, not truncated for calculation. Full-precision data live in the latest Guided `experiment.rds` or Legacy `workspace.rds`; export formatting is controlled by the original R export functions.

## App name and upgrade notice

The app is now **MRMhub GUI**. The window title omits the version; the small gray version appears beside GUI in the top-left branding. The bundle identifier is unchanged so existing settings and dataset selections continue to work.

On the first launch of the renamed app, a notice appears only when a separate old-name installation is detected. macOS checks `/Applications` and the user's `Applications` folder, verifies the old bundle identifier, and offers to move that bundle into a uniquely reserved folder in the user's Trash. This is recoverable by moving it back in Finder; no dataset/settings files are touched. Permission/cross-volume failures show manual Finder instructions without requesting elevation. The running installation and symlinked bundles are excluded. Windows checks standard installation locations and the old product's uninstall registration (both user/machine, 32/64-bit views, including custom locations). It shows Settings → Apps uninstall instructions rather than bypassing the Windows uninstaller. Keep shared app-data removal unchecked. Linux has no Applications/NSIS migration notice. The one-time marker is stored with app settings, not with a dataset.

## Saved analyses

The graph selector lists saved images from **all Guided and Legacy steps in the selected dataset**, grouped by step and date, even when the current checkpoint has no graphs. Viewing an earlier graph does not change the analysis checkpoint. **Save displayed graph…** exports that exact original image. History uses metadata references to the original checkpoint files: it creates no duplicate image copies and loads only the selected image. Keep the dataset's QUANT folder to retain these graphs across launches.

The two trash buttons next to each selector remove its selected item or all items after confirmation. **All plots** covers saved images from both modes, retaining sessions, data and non-image exports. **All checkpoints** applies only to the current Guided/Legacy mode and includes those checkpoints' sessions, data snapshots and outputs. Other datasets, input files and exports outside these checkpoints are never touched. Checkpoint deletion selects a remaining checkpoint, or resets to a new session when none remain. Explicit file paths in user R code can still refer to a removed checkpoint; restore those files before using that code.

Deletion moves files without copying them into `DATASET/QUANT/.trash/q-…/`, with `restore-info.json` documenting each original path. It does not immediately reclaim disk space. To recover, close QUANT, move the listed files/folders back without overwriting existing items, then reopen the dataset. Moving original PNGs back automatically restores their selector entries. **Free old session storage…** permanently empties this trash after confirmation, as well as retiring older session snapshots. Only use it when recovery is no longer needed. Trash is excluded from active history.

In the enlarged plot viewer, **W/A/S/D** moves the viewing window up/left/down/right by 20% of the currently visible image area, clamped at the edges. This gives smaller source-image jumps at higher zoom. The progress bar's animated `#` is light blue and its current-operation text is yellow; the filled section and numerical percentage remain neutral.

Click any graph in **Graphs & outputs** to open the original PNG in a large viewer. Scroll/trackpad zoom and `+`/`=`/`-` zoom around the cursor; drag to pan, **Fit** resets the view, and **100%** displays native pixels. Escape closes the viewer. New Guided PNGs and Legacy's default graphics device render at 300 DPI, retaining their previous physical dimensions and calculations. Existing saved plots and explicitly exported images retain their original resolution; zoom does not invent image detail. Guided PDF output is unchanged.

Each successful operation records generated outputs, request/settings, R session information, and its activity log in `DATASET/QUANT/q-…/`. A completion manifest is written only after the R process succeeds. Failed jobs retain diagnostic logs but do not replace a successful session snapshot.

The checkpoint selector lists resumable sessions only; the graph selector also includes earlier, output-only runs. Histories and remembered selections are dataset-specific. Editing or switching datasets never reuses another dataset's results. A changed bundled QUANT source requires a new import before processing old checkpoints; previously exported files remain accessible. Retain the QUANT folder if you need the analysis history.

**Save …** buttons copy outputs through the native Save dialog; output files already exist inside the checkpoint folder. No uploads or online analysis are involved. Internet access is needed for dependency setup only.

### Bounded session storage

New runs keep **one latest resumable snapshot per workflow per dataset**, rather than a full data copy after every step. The new snapshot is committed before the previous one is retired, so a failed run keeps the last successful session. Allow temporary space for both snapshots during a run. Legacy saves only its workspace, not a duplicate experiment. Guided plot/export operations reuse the existing snapshot through a hard link when supported, with a normal save as the cross-platform fallback.

Graphs, PDFs, exports, code and logs remain available from earlier runs. These outputs can still grow with use; explicit exports and user-created R objects are not silently removed. Save any automatic session snapshot you want to keep outside QUANT before the next successful run. This policy bounds automatic history copies without requiring a long-lived R process or changing analysis calculations.

Checkpoints created by older versions are not automatically retired. **Free old session storage…** asks for confirmation, then keeps only the newest resumable Guided and Legacy sessions, removes older automatic snapshot/plot-object files, and permanently empties this dataset's QUANT trash. Earlier outputs outside trash, input datasets and Integrator results stay untouched. Retired sessions and emptied trash cannot be restored by the app.

## Developer verification

From the repository root:

```sh
cargo test --manifest-path integrator_w_gui/gui/src-tauri/Cargo.toml
deno test integrator_w_gui/gui/tests
node integrator_w_gui/gui/tests/quant-paste-integration.mjs
Rscript --vanilla integrator_w_gui/gui/tests/quant-runner.R /absolute/path/to/quant/R/library
Rscript --vanilla integrator_w_gui/gui/tests/quant-legacy.R /absolute/path/to/quant/R/library
```

The R suite tests native-import parity (including ASSAY when present), exact numerical parity through ISTD normalization, quantitation, interference/drift/batch correction and QC filtering, metadata edit validation, plot generation, byte-identical CSV exports, workbook/template exports, paginated tables, and failure isolation. It uses an isolated temporary workspace. Rust tests cover checkpoint/artifact path validation and source embedding; frontend tests cover typed settings and missing values.

`tests/quant-ui-preview.html`, served locally from the repository root, is an isolated manual smoke test for console colors, saved preferences, expansion, and original-resolution plot zoom/pan. It generates only synthetic output and a test image; no dataset or native shell is accessed. Check native terminal resizing separately in the desktop app.

`tests/quant-workflow-preview.html` exercises cross-step graph selection, expanded-only Legacy progress, completion cleanup and scroll preservation with a synthetic bridge. The R Legacy test also verifies progress records and that subsequent steps neither copy nor modify earlier graph files.

`src-tauri/build.rs` embeds DESCRIPTION, NAMESPACE, R sources (including sysdata), example data, and template files at build time, with a source fingerprint. Keep the GUI inside the full repository when building. The app does not bundle the R runtime. Windows runtime behavior must also be smoke-tested on an actual Windows machine before release.

The CodeMirror editor is shipped as `ui/quant/r-editor.bundle.js` with `EDITOR-LICENSES.txt`, so normal app builds and users need neither npm nor a CDN. To change/rebuild the editor, run `npm ci --ignore-scripts` then `npm run build` in `gui/editor`; commit the lockfile and regenerated bundle/licenses alongside the source.

The same build bundles xterm.js and its fit add-on into `ui/quant/terminal.bundle.js` / `.css` with `TERMINAL-LICENSES.txt`. Commit these offline assets too. Native shells use `portable-pty`; Bash is not required on Windows. Check that path with `cargo xwin check --target x86_64-pc-windows-msvc --manifest-path integrator_w_gui/gui/src-tauri/Cargo.toml` when cross-compilation tools are installed.
