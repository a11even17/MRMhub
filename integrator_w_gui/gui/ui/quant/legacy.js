// Step names follow the original lipidomics tutorial, not the guided UI groups.
export const legacySteps = [
  "Set up a project", "Importing analysis results", "A glimpse on the imported data",
  "Analytical design and timeline", "Overview of chromatographic separation",
  "Peak picking QC", "Signal trends of internal standards", "Adding detailed metadata",
  "Overall trends and possible outliers", "PCA of all QC types", "Excluding technical outliers",
  "Response curves", "Isotope interference correction",
  "Normalization and quantification based on ISTDs", "Effects of class-wide ISTD normalization",
  "Drift correction", "Batch-effect correction", "Saving runscatter plots of all features as PDF",
  "QC-based feature filtering", "Summary of the QC filtering", "Lipidome profile",
  "Saving a report with data, metadata and processing details", "Sharing the MRMhubExperiment dataset",
];
export const legacyDraftKey = path => `mrmhub-quant-legacy-drafts:${path}`;
export function historyForMode(history, mode) {
  return history.filter(item => item.resumable !== false && (item.action === "legacy") === (mode === "legacy"));
}
