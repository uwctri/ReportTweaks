# Report Tweaks - Redcap External Module

More complete end-user facing documentation can be found [here](https://aanunez.io/docs/report-tweaks/)

## What does it do?

Report tweaks adds options to hide redcap generated columns, merge rows from the same record, hide empty rows, and add "writeback" buttons to reports that allow for flags or action dates to be set on all records in a report. 

## Installing

You can install the module from the REDCap EM repo or drop it directly in your modules folder (i.e. `redcap/modules/report_tweaks_v1.0.0`).

## Configuration

Configuration is done on the edit report screen under a new "Report Tweaks" section. Some settings can also be toggled on the report itself.

* By default "redcap_event_name" is displayed in a report (if it exists) as this is typical redcap behavior

* Rows will be merged when both share a common record_id (or equivalent) and are, excluding REDCap generated columns, disjoint. This is most common when data is pulled from two different forms on separate events. This feature is not helpful for removing many rows returned from the same repeating instance as those rows will likely have many of the same data points (i.e. have data in the same column).

* Adding a Writeback feature will display a button on the report that end-users can click to update some field on a subject's record to a defined value. Settings for the writeback feature can be enabled by checking the box next to the feature and edited by clicking the "configure" button. That value could be static (i.e. set only in the Edit Report screen), determined by the user when they click the writeback button, or the current date.

* The field used by the date range live filter must be on the report

## Call Outs / Issues / Planned Features

* Update end-user facing docs to include info about date range filtering, removing rows, the copy button, and search ranges