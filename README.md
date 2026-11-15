# Report Tweaks - REDCap External Module

## What does it do?

Combining repeating instruments and longitudinal events in REDCap reports often produces sparse, multi-row tables that require manual reshaping before analysis. Report Tweaks lets you reshape report rows server-side—merging disjoint rows, copying non-repeating ("core") fields onto repeating rows, or flattening all data into one row per subject—and apply those same transformations to CSV data exports. It also adds live range filters, column toggles, and multi-field writeback buttons directly on reports.

## Features

* **Server-Side Row Reshaping** - Merge disjoint rows for the same record or pivot repeating instruments and events into one wide row per subject across the entire report.
* **Core-to-Repeat Fill** - Copy non-repeating ("core") field values onto repeating rows, with an option to drop the standalone core row.
* **Tweaked CSV Exports** - Export raw or labeled CSV files with all report reshaping, empty-row removal, and column hiding applied.
* **Report Writeback Buttons** - Configure buttons on a report to batch-update one or more fields across visible records with a pre-flight preview.
* **Live Report Filters & UX** - Add min/max range filters, date-range quick filters, column visibility toggles, and collapsible report descriptions.

## Installing

You can install the module from the REDCap EM repo or drop it directly into your modules folder (i.e. `redcap/modules/report_tweaks_v1.0.0`) and enable it in the Control Center and your project.
