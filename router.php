<?php
if( $_POST['route'] == "saveConfig" ) {
    $module->saveReportConfig();
} elseif ( $_POST['route'] == "reportWrite" ) {
    echo $module->reportWrite();
}
?>