<?php
$HtmlPage = new HtmlPage();
$HtmlPage->addStylesheet("home.css", 'screen,print');
$HtmlPage->PrintHeader();
include APP_PATH_VIEWS . 'HomeTabs.php';

?>

<body class="bg-light">
    <div class="container">
        <h2 class="my-4 fw-bold"><i class="fas fa-info-circle"></i> How to use the Report Tweaks External Module</h2>
        <div class="card my-4 card-primary">
            <div class="card-header text-white fw-bold bg-primary bg-gradient">Purpose</div>
            <div class="card-body">
                The Report Tweaks external module allows end-users to apply a variety of tweaks to individual reports
                from the "Edit Report" page. These tweaks currently include:
                <ul>
                    <li>Include or exclude <code>redcap_event_name</code> in the report and exports. Useful for cleaning up the report when the column isn't needed.</li>
                    <li>Reshape rows for the same record—either merge disjoint rows or flatten everything into one row per subject (wide pivot).</li>
                    <li>Copy "core" (non-repeating) row values onto repeating rows, with an option to drop the standalone core row.</li>
                    <li>Remove rows with no data. Useful if your report filtering occasionally returns blank rows.</li>
                    <li>Export tweaked CSV files (Raw or Labels) with all row reshaping, core-row fill, and empty-row removal applied.</li>
                    <li>Show the report's filter logic. Useful if users want to see how the report is filtered without having edit access.</li>
                    <li>Add a date-range live filter to narrow rows down to common time periods.</li>
                    <li>Collapse longer report descriptions.</li>
                    <li>Add one or more "writeback" buttons to update values in the database for visible rows in a report.</li>
                </ul>
                Regardless of configuration, the following additions are made to all reports:
                <ul>
                    <li>Minimum and Maximum search boxes to filter arbitrary ranges on a selected column.</li>
                    <li>A copy button that copies all visible data in the report to the clipboard.</li>
                    <li>Checkboxes to toggle showing REDCap-generated columns on the report.</li>
                    <li>Tweaked CSV export option inside REDCap's Export Data dialog.</li>
                </ul>
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Prerequisites</div>
            <div class="card-body">
                Using this EM requires <b>no</b> special knowledge, changes to your project settings, or intervention by
                administrators. The EM can be fully configured with only access to Edit Reports.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-primary bg-gradient">Using the module</div>
            <div class="card-body">
                <div class="text-center"><img class="img-fluid" src="https://aanunez.io/img/report_tweaks_1.PNG">
                </div><br>
                All configuration for Report Tweaks is controlled on the Edit Report page, just below the "Additional
                Report Options" section. Settings can be enabled or disabled by any user able to access this page. As
                with changes to any other report setting, you will need to click "Save Report" after changing any
                settings for Report Tweaks. By default, new reports will have the "Include redcap_event_name in the
                report" box checked as this is typical REDCap behavior. <b>It should be noted that new reports cannot
                immediately have their Report Tweaks settings changed and must first be saved so a Report ID can be
                assigned by REDCap.</b>
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Reshaping &amp; Flattening Rows</div>
            <div class="card-body">
                <p>Report Tweaks performs row reshaping on the server, so it works across the entire report—even on large, multi-page reports. There are two reshaping modes:</p>
                <ul>
                    <li><b>Merge disjoint rows:</b> Rows sharing a common <code>record_id</code> are combined when their non-REDCap columns do not conflict. This is most common when data is pulled from different non-repeating forms across separate events.</li>
                    <li><b>Flatten to one row per subject (wide pivot):</b> Collapses all rows for each <code>record_id</code> onto a single row. Fields that only have one value per subject stay in their original column, while fields that vary across events or repeating instances are pivoted into separate columns (e.g., <code>field__event__instrument_1</code>).</li>
                </ul>
                A report must include <code>record_id</code> (or your project's record ID field) for row reshaping to work.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Copy Core Row to Repeating Rows</div>
            <div class="card-body">
                When a report combines non-repeating forms (like demographics) with repeating instruments, REDCap puts the non-repeating fields on a separate "core" row and leaves them blank on every repeating row. Enabling <b>Copy core (non-repeating) row values onto repeating rows</b> fills those blank cells on each repeating row using the record's non-repeating row (matching by event first, or falling back to the record's baseline core row). You can also check <b>Drop standalone core row when repeating rows exist</b> to remove the extra non-repeating row once its values have been copied.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Remove Empty Rows</div>
            <div class="card-body">
                Rows with no data can be filtered out easily. Using this feature as a replacement for normal REDCap event
                filtering is discouraged as it can slow down large reports that need many rows removed. Rows are
                considered "empty" if they contain no data other than REDCap-generated (<code>redcap_</code>) fields and
                <code>record_id</code>. Empty rows removed this way are excluded from both the on-screen report and
                Tweaked CSV Exports.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Tweaked Data Exports</div>
            <div class="card-body">
                When you click REDCap's normal <b>Export Data</b> button on a report, an <b>Export tweaked data</b> checkbox is added to the export dialog. When checked (for CSV Raw or CSV Labels), Report Tweaks uses all of your selected export options (de-identification, date shifting, DAGs, survey fields, delimiters, and live filters) and applies your configured row reshaping, core-row fill, empty-row removal, and column settings before downloading the CSV.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Show Report Filter Logic</div>
            <div class="card-body">
                For users who want to see exactly how a report is pulling data, this option adds a toggle button
                to display the report's filter logic.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Date Range Filter</div>
            <div class="card-body">
                The date range filter requires a date field to be selected in the report's configuration. A drop-down is then
                available on the report allowing dynamic filtering of rows based on the selected date value.
                The field used by this filter must be included on the report.
                Available options for filtering include:
                <ul>
                    <li>Yesterday</li>
                    <li>Past Week</li>
                    <li>Past 2 Weeks</li>
                    <li>Past Month</li>
                    <li>Past 2 Months</li>
                    <li>Past 3 Months</li>
                    <li>Past Year</li>
                </ul>
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Report Writebacks</div>
            <div class="card-body">
                <div class="row">
                    <div class="col-lg-6">
                        <p>Adding a Writeback feature displays a button on the report that end-users can click to
                            update one or more fields on a subject's record to a defined value. Writebacks can be enabled
                            by checking the box next to the feature and edited by clicking the "Configure" link. Each
                            button can target one or multiple field rules, and each value can be static, entered by the
                            user when clicking the button, set to today's date, or set to the user's username. Multiple
                            writeback buttons are supported.</p>
                        <p>Helpful FYIs</p>
                        <ul>
                            <li>The user who clicks the writeback button needs edit permissions for each target form.</li>
                            <li>Target fields do not need to be displayed on the report.</li>
                            <li>Before writing, a preview shows how many records and cells will be updated or skipped.</li>
                            <li>Incrementing a write value is only supported for dates and integers.</li>
                            <li>Footer, message, and button text are all HTML enabled.</li>
                            <li>The event name can still be pulled from the report even if it is hidden by Report Tweaks.</li>
                        </ul>
                    </div>
                    <div class="col-lg-6 text-center">
                        <img class="img-fluid" src="https://aanunez.io/img/report_tweaks_2.PNG">
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

<?php

$HtmlPage->PrintFooter();
?>
