<?php
if( $_POST['route'] == "save" ) {
    $module->saveReportConfig();
} elseif ( $_POST['route'] == "reportWrite" ) {
    $module->reportWrite();
}
?>