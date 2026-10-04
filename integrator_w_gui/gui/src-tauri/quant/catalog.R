# A GUI adapter only: all scientific operations remain in the bundled package.
# Defaults below mirror tutorial-03; sample-specific IDs are deliberately absent.
quant_catalog <- function() {
  op <- function(id, label, stage, kind = "process", defaults = list(), note = "") {
    list(id = id, label = label, stage = stage, kind = kind, defaults = defaults, note = note)
  }
  list(
    op("import_data_mrmhub", "Import MRMhub results", "1 · Import", "import", list(import_metadata = TRUE), "Use the integrator's long.csv, or an MRMhub CSV/TSV export. Original files are never modified."),
    op("import_metadata_msorganiser", "Import metadata workbook", "2 · Annotate", "metadata", note = "Use an MSorganiser workbook. For separate metadata tables, choose the corresponding import below. Metadata changes reset downstream processing in QUANT; rerun it afterwards."),
    op("import_metadata_analyses", "Import sample / run metadata", "2 · Annotate", "metadata"),
    op("import_metadata_features", "Import feature metadata", "2 · Annotate", "metadata"),
    op("import_metadata_istds", "Import internal-standard concentrations", "2 · Annotate", "metadata"),
    op("import_metadata_responsecurves", "Import response-curve metadata", "2 · Annotate", "metadata"),
    op("import_metadata_qcconcentrations", "Import QC concentrations", "2 · Annotate", "metadata"),
    op("set_analysis_order", "Set run order", "2 · Annotate", defaults = list(order_by = "timestamp")),
    op("set_intensity_var", "Choose intensity measure", "2 · Annotate", defaults = list(variable_name = "area")),
    op("plot_runsequence", "Run sequence", "3 · Inspect", "plot", list(show_batches = TRUE, batch_zebra_stripe = TRUE, batch_fill_color = "#fffbdb", segment_linewidth = .5, show_timestamp = FALSE)),
    op("plot_abundanceprofile", "Retention-time / abundance profile", "3 · Inspect", "plot", list(variable = "rt", qc_types = "SPL", log_scale = FALSE, density_strip = TRUE, show_sum = FALSE, feature_map = "lipidomics")),
    op("plot_rt_vs_chain", "Retention time vs lipid chain", "3 · Inspect", "plot", list(qc_types = "SPL", x_var = "total_c", outlier_residual_min = .3, font_base_size = 8, point_size = 1)),
    op("plot_runscatter", "Feature intensities across runs", "3 · Inspect", "plot", list(variable = "intensity", qc_types = c("BQC", "TQC", "SPL", "PBLK", "SBLK"), cap_outliers = TRUE, log_scale = FALSE, show_batches = TRUE, font_base_size = 5, cols_page = 4, rows_page = 3)),
    op("plot_rla_boxplot", "Relative log abundance", "3 · Inspect", "plot", list(variable = "intensity", rla_type_batch = "within", qc_types = c("BQC", "SPL", "RQC", "TQC", "PBLK"), filter_data = FALSE, show_timestamp = FALSE, outlier_exclude = FALSE, x_gridlines = FALSE, batch_zebra_stripe = FALSE, linewidth = .1)),
    op("plot_pca", "Principal component analysis", "3 · Inspect", "plot", list(variable = "feature_intensity", qc_types = c("SPL", "BQC", "TQC"), filter_data = FALSE, log_transform = TRUE, include_istd = FALSE, point_size = 2, ellipse_alpha = .3, font_base_size = 8)),
    op("exclude_analyses", "Exclude selected runs", "3 · Inspect", defaults = list(clear_existing = TRUE), note = "Enter actual analysis IDs from the tables. Exclusions do not delete the original measurements."),
    op("filter_features_qc", "Filter features by QC", "4 · QC & interference", defaults = list(include_qualifier = FALSE, include_istd = TRUE, min.intensity.median.spl = 200), note = "Initial tutorial filter: intensity ≥200, keep ISTDs. For final filtering, edit thresholds and turn off include ISTD. Response filters require annotated response curves; concentration CV requires quantitation."),
    op("plot_responsecurves", "Response curves", "4 · QC & interference", "plot", list(variable = "intensity", filter_data = TRUE, cols_page = 5, rows_page = 4)),
    op("correct_custom_interferences", "Correct annotated interferences", "4 · QC & interference", note = "Requires interference annotations. Do not run unless applicable to this dataset."),
    op("plot_interference_correction", "Review interference correction", "4 · QC & interference", "plot", list(qc_types = c("BQC", "SPL", "TQC", "LTR"))),
    op("normalize_by_istd", "Normalize by internal standards", "5 · Quantitate", note = "Requires feature-to-ISTD assignments and the matching standards in your measurements."),
    op("quantify_by_istd", "Calculate concentrations", "5 · Quantitate", note = "Normalize first. Requires ISTD concentrations, sample amounts, and ISTD volumes. Missing values are reported by QUANT, never guessed."),
    op("plot_normalization_qc", "Review normalization", "5 · Quantitate", "plot", list(before_norm_var = "intensity", after_norm_var = "norm_intensity", plot_type = "diff", qc_types = c("TQC", "BQC", "SPL"), facet_by_class = TRUE, point_size = 2, y_lim = c(-5, 15))),
    op("correct_drift_gaussiankernel", "Correct within-batch drift", "6 · Correct & review", defaults = list(variable = "conc", ref_qc_types = "SPL", ignore_istd = TRUE, batch_wise = TRUE, replace_previous = TRUE, recalc_trend_after = TRUE, kernel_size = 10, outlier_filter = FALSE, outlier_ksd = 5, location_smooth = TRUE, scale_smooth = FALSE), note = "Tutorial uses study samples as reference. Choose reference QC types appropriate to your design."),
    op("correct_batch_centering", "Correct between-batch differences", "6 · Correct & review", defaults = list(variable = "conc", ref_qc_types = "SPL", replace_previous = TRUE, correct_scale = TRUE, log_transform_internal = TRUE)),
    op("plot_qc_summary_byclass", "QC summary by class", "7 · Final QC & export", "plot"),
    op("plot_qc_summary_overall", "Overall QC summary", "7 · Final QC & export", "plot"),
    op("save_report_xlsx", "Export Excel report", "7 · Final QC & export", "export", list(filtered_variable = "conc")),
    op("save_dataset_csv", "Export processed dataset", "7 · Final QC & export", "export", list(variable = "conc", qc_types = "SPL", include_qualifier = FALSE, filter_data = TRUE)),
    op("save_metadata_templates", "Export editable metadata templates", "2 · Annotate", "export"),
    op("save_metadata_msorganiser_template", "Export metadata workbook template", "2 · Annotate", "export")
  )
}

quant_schema <- function(entry) {
  labels <- c(path = "Input file", sheet = "Workbook sheet", qc_types = "Sample types to include",
              ref_qc_types = "Reference sample types", variable = "Measurement", variable_name = "Intensity measure",
              include_istd = "Include internal standards", include_qualifier = "Include qualifier transitions",
              include_feature_filter = "Only features matching (regular expression)", exclude_feature_filter = "Exclude features matching (regular expression)",
              filter_data = "Use QC-filtered data", kernel_size = "Drift smoothing window", order_by = "Order runs by",
              import_metadata = "Extract metadata from the results", ignore_warnings = "Allow metadata validation warnings",
              ignore_missing_annotation = "Allow missing annotations", concentration_unit = "Concentration basis",
              "min.intensity.median.spl" = "Minimum median study-sample intensity", "max.cv.conc.bqc" = "Maximum BQC concentration CV (%)",
              "response.curves.selection" = "Response curve IDs", "features.to.keep" = "Always keep these feature IDs")
  fun <- getExportedValue("mrmhub", entry$id)
  args <- formals(fun)
  hidden <- c("data", "...", "table", "output_pdf", "return_plots", "multithreading", "show_progress", "create_dir", "overwrite")
  if (entry$kind == "plot") hidden <- c(hidden, "path")
  if (entry$kind == "export") hidden <- c(hidden, "path")
  fields <- lapply(setdiff(names(args), hidden), function(name) {
    required <- identical(args[[name]], quote(expr = ))
    raw <- paste(deparse(args[[name]]), collapse = "")
    value <- if (name %in% names(entry$defaults)) entry$defaults[[name]] else if (!required) tryCatch(eval(args[[name]], baseenv()), error = function(e) NULL) else NULL
    # Choice defaults in QUANT are vectors consumed by arg_match(). Preserve
    # omission unless the user opts in; do not turn a vector into a wrong default.
    type <- if (is.logical(value) && length(value) == 1 && !is.na(value)) "boolean" else if (is.numeric(value)) "number" else "text"
    if (name %in% c("show_sum", "include_istd", "include_qualifier", "show_legend_title", "add_qctype")) type <- "boolean"
    if (grepl("^(min[.]|max[.]|response.curves.selection$)|(_size|_alpha|_width|_height|_linewidth|_ksd|_threshold|_lim)$", name)) type <- "number"
    vector <- length(value) > 1 || name %in% c("qc_types", "ref_qc_types", "analyses", "features.to.keep", "response.curves.selection", "feature_list", "pca_dims", "y_lim", "x_lim")
    list(name = name, label = if (name %in% names(labels)) unname(labels[[name]]) else gsub("[_.]", " ", name), type = type, vector = vector,
         required = required, enabled = name %in% names(entry$defaults),
         value = value, original = raw)
  })
  entry$fields <- fields
  entry$defaults <- NULL
  entry
}
