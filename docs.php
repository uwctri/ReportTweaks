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
                    <li>Include/Exclude the <code>redcap_event_name</code> from the report. Useful for styling the
                        report for smaller screens if the column isn't needed. </li>
                    <li>Combine (merge) rows representing the same record on the report. </li>
                    <li>Remove rows with no data. Useful if your report filtering occasionally returns blank rows.</li>
                    <li>Show the reports filter logic. Useful if advanced users want to see the report's logic, but shouldn't be allowed to edit the report.</li>
                    <li>Add a date-range live filter to filter rows down to those with a date in a common time range</li>
                    <li>Collapse longer report descriptions</li>
                    <li>Add one or multiple "writeback" buttons to the report to update values in the database for all rows in a report. </li>
                </ul>
                Regardless of configuration the following additions are made to all reports:
                <ul>
                    <li>Minimum and Maximum search boxes are added to find arbitrary ranges on a selected column</li>
                    <li>A copy button is added that copies all visible data in the report</li>
                    <li>Checkboxes to toggle showing REDCap generated columns on the report</li>
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
                with changes to any other report setting you will need to click "Save Report" after changing any
                settings for Report Tweaks. By default new reports will have the "Include redcap_event_name in the
                report" box checked as this is typical REDCap behaviour. <b>It should be noted that new reports cannot
                    immediately have their Report Tweaks settings changed and must first be saved so a Report ID can be
                    assigned by REDCap.</b>
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Combining Rows</div>
            <div class="card-body">
                Rows will be merged when both share a common <code>record_id</code> and are, excluding REDCap generated
                columns, disjoint. This is most common when data is pulled from two different forms on separate events.
                This feature is not helpful for removing many rows returned from the same repeating instance as those
                rows will likely have many of the same data points (i.e. have data in the same column). A report must
                include the <code>record_id</code>, or its equivalent, for this feature to work.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Remove Empty Rows</div>
            <div class="card-body">
                Rows with no data can be filtered out easily. Using this feature as a replacement for normal REDCap event
                filtering is discouraged as it will slow down any large report that needs many rows removed. Rows are
                "empty" if they contain no data other than REDCap generated (<code>redcap_</code>) fields. Data filtered
                this way is still included in Data Exports, but not when using the EM's copy data button.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Show Report Filter Logic</div>
            <div class="card-body">
                For users that want to be reminded exactly of how the report is pulling data, this option adds a toggle
                to display the report's filter logic.
            </div>
        </div>
        <div class="card my-4">
            <div class="card-header text-white fw-bold bg-secondary bg-gradient">Date Range Filter</div>
            <div class="card-body">
                The date range filter requires a date field be selected in the Reports configuration. A drop down is then
                available on the report allowing the dynamic filtering of rows based on the selected value for the row.
                The field used by this filter must be on the report.
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
                        <p>Adding a Writeback feature will display a button on the report that end-users can click to
                            update some field on a subject's record to a defined value. Settings for the writeback
                            feature can be enabled by checking the box next to the feature and edited by clicking the
                            "configure" button. That value could be static (i.e. set only in the Edit Report screen),
                            determined by the user when they click the writeback button, the current date, or the
                            username of the person clicking the button. Multiple write back buttons are supported.</p>
                        <p>Helpful FYIs</p>
                        <ul>
                            <li>The user that clicks the writeback button will need to have appropriate permissions to
                                write to the target field</li>
                            <li>The target field need not be listed on the report</li>
                            <li>Incrementing a write value is only supported for dates and integers</li>
                            <li>Footer, message, and button text are all HTML enabled</li>
                            <li>We can still pull the event name from the report if it is hidden by Report Tweaks</li>
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