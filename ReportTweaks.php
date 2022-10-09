<?php

namespace UWMadison\ReportTweaks;
use ExternalModules\AbstractExternalModule;
use REDCap;

class ReportTweaks extends AbstractExternalModule {
    
    private $module_global = 'ReportTweaks';
    private $defaultSettings = ['includeEvent'=>true];
    
    /*
    Primary Redcap Hook, loads config and Report pages
    */
    public function redcap_every_page_top($project_id) {
        
        // Bail if user isn't logged in
        if ( !defined("USERID") ) {
            return;
        }
        
        $report_id = $_GET['report_id'];
        
        // Custom Config page
        if ( $this->isPage('ExternalModules/manager/project.php') && $project_id ) {
            $this->includePrefix();
            $this->includeJs('config.js');
        }
        
        // Reports Page (Edit or View Report, Not the all-reports page or stats/charts)
        elseif ( $this->isPage('DataExport/index.php') && $project_id && ($report_id || $_GET['create'] ) && !$_GET['stats_charts']) {
            $this->loadSettings($report_id);
            $this->includeCSS();
            include('templates.php');
            if ( $_GET['addedit'] ) {
                $this->includeDateFields();
                $this->includeJs('editTweaks.js');
            } else {
                $this->includeCookies();
                $this->loadReportSorting($report_id);
                $this->loadReportHeaders($report_id);
                $this->includeJs('viewTweaks.js');
            }
        }
    }
    
    /*
    Save all report config to a single json setting for the EM. 
    Invoked via router/ajax
    */
    public function saveReportConfig() {
        $json = $this->getProjectSetting('json');
        $json = empty($json) ? array() : json_decode($json, true);

        // Escape 3 feilds that are html enabled 
        $new = json_decode($_POST['settings'], true);
        if ( !empty($new['_wb']) ) {
            foreach( ['footer','modalBtn','modalText'] as $html ) {
                $new['_wb'][$html] = REDCap::escapeHtml($new['_wb'][$html]);
            }
        }

        $json[$_POST['report']] = $new;
        $this->setProjectSetting('json', json_encode($json));
    }
    
    /*
    Perform a write back from a report. Write some value to a series of
    records with event/instrument/instance info. Invoked via router/ajax
    */
    public function reportWrite() {
        // Gather info
        $writeBackData = (array) json_decode($_POST['writeArray'],true);
        $pid = $_GET['pid'];
        $field = $_POST['field'];
        $overwrite = json_decode($_POST['overwrite']);
        $eventMap = $this->makeEventMap($pid);
        $instrumentMap = $this->makeInstrumentMap();
        $writeArray = [];
        
        // Get User rights to check if we can write to the field
        $user = $this->getUser()->getUsername();
        $rights = REDCap::getUserRights($user)[$user]['forms'];
        $form = REDCap::getDataDictionary($pid,'array')[$field]['form_name'];
        if ( $rights[$form] != "1" ) { // 1 is View&Edit, 0 is Hidden, 2 is View Only
            echo json_encode([
                "form" => $form,
                "warnings" => [$this->tt('warning_1')],
                "errors" => []
            ]);
            return;
        }
        
        // Loop over every line of the report we got back
        foreach ( $writeBackData as $data ) {
            
            // If we were sent a display name, swap it to an id (or internal instrument name)
            $event = is_numeric($data['event']) ? $data['event'] : $eventMap[$data['event']];
            $instrument = $instrumentMap[$data['instrument']] ?? "";
            $record = $data['record'];
            $instance = $data['instance'] ?? "";
            
            // Make sure field exists on event, shouldn't be an issue
            if (empty($event) || !in_array($field, REDCap::getValidFieldsByEvents($pid, $event))) {
                continue;
            }
            
            // If no overwritting then make sure we don't blow away data
            if ( !$overwrite ) {
                $existingData = REDCap::getData($pid, 'array', $record, $field, $event)[$record];
                if( !empty($instrument) ) { 
                    if (!empty($existingData["repeat_instances"][$event][$instrument][$instance][$field]))
                        continue;// Don't do write
                }
                elseif ( !empty($existingData[$event][$field]) ) {
                    continue; // Don't do write
                }
            }
            
            // Set value on repeat or single instrument
            if( !empty($instrument) ) {
                // Note: Field might not be on instrument if malicious, saveData will catch this though
                $writeArray[$record]["repeat_instances"][$event][$instrument][$instance][$field] = $data['val'];
            } else {
                $writeArray[$record][$event][$field] = $data['val'];
            }
        }
        
        // Save and return or pass error
        if ( !empty($writeArray) ) {
            $out = REDCap::saveData($pid, 'array', $writeArray);
        } else {
            $out = [ 
                "warnings" => [$this->tt('warning_2')],
                "errors" => []
            ];
        }
        echo json_encode($out);
    }
    
    /*
    Inits the ReportTweaks global and loads the settings for
    a report ID. Also packs the Redcap JS object
    */
    private function loadSettings( $report ) {
        
        // Setup Redcap JS object
        $this->initializeJavascriptModuleObject();
        $this->tt_transferToJavascriptModuleObject();
        
        // Get the EM's settings
        $json = ((array)json_decode( $this->getProjectSetting('json') ))[$report];
        $json = empty($json) ? $this->defaultSettings : $json;
        
        // Organize the strucutre
        $data = json_encode([
            "isLong" => REDCap::isLongitudinal(),
            "csrf" => $this->getCSRFToken(),
            "router" => $this->getUrl('router.php'),
            "record_id" => REDCap::getRecordIdField(),
            "settings" => $json
        ]);
        
        // Pass down to JS
        echo "<script>var {$this->module_global} = {$data};</script>";
        echo "<script> {$this->module_global}.em = {$this->getJavascriptModuleObjectName()}</script>";
    }
    
    /*
    Pass down sorting info for the report. The datatalbes 
    API doesn't store inital sorting order.
    */
    private function loadReportSorting( $report ) {
        $sql = '
            SELECT orderby_field1, orderby_field2, orderby_field3, 
            orderby_sort1, orderby_sort2, orderby_sort3
            FROM redcap_reports 
            WHERE report_id = ?';
        $result = $this->query($sql, [$report]);
        $row = $result->fetch_assoc();
        foreach( range(1,3) as $i ) {
            $orders[] = ['field'=>htmlentities($row["orderby_field$i"], ENT_QUOTES),
                         'sort' =>htmlentities($row["orderby_sort$i"], ENT_QUOTES)];
        }
        $orders = json_encode($orders);
        echo "<script>{$this->module_global}.sort = {$orders};</script>";
    }

    /*
    Pass down a mapping of key headers on the report.
    */
    private function loadReportHeaders( $report ) {

        // Global with metadata
        global $Proj;
        $proj = (array)$Proj;
        $record_id = REDCap::getRecordIdField();
        $headers = [];
        $redcap_fields = ["redcap_repeat_instrument","redcap_repeat_instance","redcap_event_name"];

        // Some users won't be able to get fields via getReport below, this is our fallback
        $idx = 0;
        $sql = '
            SELECT field_name FROM redcap_reports_fields 
            WHERE report_id = ? 
            AND isNull(limiter_group_operator) 
            ORDER BY field_order';
        $result = $this->query($sql, [$report]);
        while ( $row = $result->fetch_assoc() ){
            $name = $row["field_name"];
            $headers[$name] = [
                "index" => $idx,
                "validation" => $proj["metadata"][$name]["element_validation_type"]
            ];
            $idx += 1;
        }

        // Grab all data via the api as a csv, strip it down to just headers and package it
        $csv = explode(',',preg_split("@[\s+　]@u",REDCap::getReport($report,'csv'))[0]);
        $csv = array_combine($csv, range(0, count($csv)-1));
        $maxRedcap = -1;
        $minRedcap = 999;
        $rowCount = 0;
        foreach ( $csv as $name => $index ) {
            $headers[$name] = [
                "index" => $index,
                "validation" => $proj["metadata"][$name]["element_validation_type"]
            ];
            if ( in_array($name, $redcap_fields) ) {
                if ($index > $maxRedcap) $maxRedcap = $index;
                if ($index < $minRedcap) $minRedcap = $index;
            } else {
                $rowCount += 1;
            }
        }

        // If the user didn't have full export rights then they only get the 3 redcap_
        // vars, we can adjust values we got from the SQL query to yeild correct indexes
        if ( ($maxRedcap >= 0) && ($maxRedcap != $minRedcap) && ($idx != $rowCount) ) {
            foreach ( $headers as $name => $data ) { 
                if ( !in_array($name, $redcap_fields) && $data["index"] >= $minRedcap ) {
                    $headers[$name]["index"] = $data["index"] + $maxRedcap;
                }
            }
        }

        // Prep for export to JS
        $headers = array_merge(["record_id" => $headers[$record_id]],$headers);
        $formated = json_encode([
            "all" => $headers,
            "core" => [
                "record_id" => $headers[$record_id]["index"],
                "redcap_repeat_instrument" => $headers["redcap_repeat_instrument"]["index"],
                "redcap_repeat_instance" => $headers["redcap_repeat_instance"]["index"],
                "redcap_event_name" => $headers["redcap_event_name"]["index"]
            ]
        ]);
        echo "<script>{$this->module_global}.headers = {$formated};</script>";
    }
    
    /*
    Pass down a list of all date(time) fields
    */
    private function includeDateFields() {
        global $Proj;
        $load = [];
        foreach( $Proj->metadata as $field => $data ) {
            if ( !empty($data["element_validation_type"]) && (strpos($data["element_validation_type"], "date") !== false) ) {
                $load[] = $field;
            }
        }
        $load = json_encode($load);
        echo "<script>{$this->module_global}.fields = {$load};</script>";
    }
    
    /*
    Util functions used by writeback. Creates a map of event display
    names to event ids.
    */
    private function makeEventMap($project_id) {
        $map = array_flip(REDCap::getEventNames(false));
        if ( empty($map) ) {
            $map[""] = reset(array_keys(reset(REDCap::getData($project_id,'array', null, REDCap::getRecordIdField()))));
        }
        return $map;
    }
    
    /*
    Util functions used by writeback. Creates a map of instrument
    display names to internal names (i.e. Hello world -> hello_world)
    */
    private function makeInstrumentMap() {
        return array_flip(REDCap::getInstrumentNames());
    }

    /*
    HTML to pass down module prefix for the config page.
    */
    private function includePrefix() {
        echo "<script>var {$this->module_global} = {'modulePrefix': '{$this->getPrefix()}'};</script>";
    }
    
    /*
    HTML to include the cookie.js library 
    */
    private function includeCookies() {
        echo "<script type='text/javascript' src={$this->getURL('js/cookie.min.js')}></script>";
    }
    
    /*
    HTML to include some local JS file
    */
    private function includeJs($path) {
        echo "<script src={$this->getUrl('js/'.$path)}></script>";
    }

    /*
    HTML to include the local css file
    */
    private function includeCSS() {
        echo "<link rel='stylesheet' href={$this->getURL('style.css')}>";

    /*
Query report's logic
*/
private function advanced_logic()
{
    //////////////////////////////
    // SQL QUERY FOR ADVANCED LOGIC (start)
    //////////////////////////////

    //get report_id from the URL
    $report_id = htmlspecialchars($_GET["report_id"]);
    //it works with $this but not with $module (!?)
    //parameterized query:
    $result = $this->query(
        '
                            select advanced_logic
                            from redcap_reports
                            where
                            report_id = ?
      ',
        [
            $report_id,
        ]
    );

    //$result is a mysqli_result object (see https://www.php.net/manual/en/class.mysqli-result.php) so you can access the rows:
    while ($row = $result->fetch_assoc()) {
        // echo "advanced logic: " . $row["advanced_logic"] . "<br>";
        $adv_log = array_values($row)[0];
    };
    

    //////////////////////////////
    // SQL QUERY FOR ADVANCED LOGIC (end)
    //////////////////////////////

// save adv_log_var in an hidden html element (it will be retrieved in the js)
//I tried to create this variable in another php file and pass it to a javascript through an ajax/XMLHttprequest, but I did not get it to work-->
?>      <input type="hidden" id="adv_log_id" value="<?= htmlspecialchars($adv_log) ?>">

<?php

    }
}
