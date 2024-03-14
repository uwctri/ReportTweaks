<?php

namespace UWMadison\ReportTweaks;

use ExternalModules\AbstractExternalModule;
use REDCap;
use DataExport;

class ReportTweaks extends AbstractExternalModule
{

    private $jsGlobal = "";
    private $defaultSettings = ['includeEvent' => true];

    /*
    Primary Redcap Hook, loads config and Report pages
    */
    public function redcap_every_page_top($project_id)
    {
        // Bail if user isn't logged in
        if (!defined("USERID")) {
            return;
        }

        $report_id = $_GET['report_id'];

        // Custom Config page
        if ($this->isPage('ExternalModules/manager/project.php') && $project_id) {
            $this->loadSettings();
            $this->includeJs('config.js');
        }

        // Reports Page (Edit or View Report, Not the all-reports page or stats/charts)
        elseif ($this->isPage('DataExport/index.php') && $project_id && ($report_id || $_GET['create']) && !$_GET['stats_charts']) {
            $this->loadSettings($report_id);
            $this->includeCSS();
            include('templates.php');
            if ($_GET['addedit']) {
                $this->includeDateFields();
                $this->includeJs('editTweaks.js');
            } else {
                $this->loadReportDetails($report_id);
                $this->loadReportHeaders($report_id);
                $this->includeJs('viewTweaks.js');
            }
        }
    }

    /*
    Save all report config to a single json setting for the EM. 
    Invoked via router/ajax
    */
    public function saveReportConfig()
    {
        $json = $this->getProjectSetting('json');
        $json = empty($json) ? array() : json_decode($json, true);

        // Escape 3 feilds that are html enabled 
        $new = json_decode($_POST['settings'], true);
        if (!empty($new['_wb'])) {
            foreach ($new['_wb'] as $index => $data) {
                foreach (['footer', 'modalBtn', 'modalText'] as $html) {
                    $new['_wb'][$index][$html] = REDCap::escapeHtml($data[$html]);
                }
            }
        }

        $json[$_POST['report']] = $new;
        $this->setProjectSetting('json', json_encode($json));
    }

    /*
    Perform a write back from a report. Write some value to a series of
    records with event/instrument/instance info. Invoked via router/ajax
    */
    public function reportWrite()
    {
        // Gather info
        $writeBackData = (array) json_decode($_POST['writeArray'], true);
        $pid = $_GET['pid'];
        $saveType = 'array';
        $record_id_name = REDCap::getRecordIdField();
        $overwrite = json_decode($_POST['overwrite']);
        $instrumentMap = array_flip(REDCap::getInstrumentNames());
        $writeArray = [];

        // Data is broken into groups based on what fields we are writing to
        foreach ($writeBackData as $fieldName => $dataList) {

            // Get User rights to check if we can write to the field
            $field = $fieldName;
            $user = $this->getUser()->getUsername();
            $rights = REDCap::getUserRights($user)[$user]['forms'];
            $form = REDCap::getDataDictionary($pid, 'array')[$field]['form_name'];
            if ($rights[$form] != "1") { // 1 is View&Edit, 0 is Hidden, 2 is View Only
                echo json_encode([
                    "form" => $form,
                    "warnings" => [$this->tt('warning_1')],
                    "errors" => []
                ]);
                return;
            }

            // Loop over every line of the report we got back
            foreach ($dataList as $data) {

                // If we were sent a display name, swap it to an id (or internal instrument name)
                $event = $data['event'];
                $instrument = $instrumentMap[$data['instrument']] ?? "";
                $record = $data['record'];
                $instance = $data['instance'] ?? "";

                // Make sure field exists on event, shouldn't be an issue
                if (REDCap::isLongitudinal() && (empty($event) || !in_array($field, REDCap::getValidFieldsByEvents($pid, $event)))) {
                    continue;
                }

                // If no overwritting then make sure we don't blow away data
                if (!$overwrite) {
                    $existingData = REDCap::getData($pid, 'array', $record, $field, $event)[$record];
                    if (!empty($instrument)) {
                        if (!empty($existingData["repeat_instances"][$event][$instrument][$instance][$field]))
                            continue; // Don't do write
                    } elseif (!empty($existingData[$event][$field])) {
                        continue; // Don't do write
                    }
                }

                // Set value on repeat or single instrument
                if (!empty($instrument)) {
                    // Note: Field might not be on instrument if malicious, saveData will catch this though
                    $writeArray[$record]["repeat_instances"][$event][$instrument][$instance][$field] = $data['val'];
                } elseif (empty($event)) {
                    // Single event project
                    $saveType = 'json-array';
                    $writeArray[] = [
                        $record_id_name => $record,
                        $field => $data['val']
                    ];
                } else {
                    $writeArray[$record][$event][$field] = $data['val'];
                }
            }
        }

        // Save and return or pass error
        if (!empty($writeArray)) {
            $out = REDCap::saveData($pid, $saveType, $writeArray, 'overwrite'); #Note: overwrite here is just for saving blank values
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
    private function loadSettings($report = Null)
    {
        // Setup Redcap JS object
        $this->initializeJavascriptModuleObject();
        $this->tt_transferToJavascriptModuleObject();
        $this->jsGlobal = $this->getJavascriptModuleObjectName();
        $data = ["prefix" => $this->getPrefix()];

        if (!empty($report)) {

            // Get the EM's settings
            $json = ((array)json_decode($this->getProjectSetting('json')))[$report];
            $json = empty($json) ? $this->defaultSettings : $json;

            // Organize the strucutre
            $data = array_merge($data, [
                "isLong" => REDCap::isLongitudinal(),
                "csrf" => $this->getCSRFToken(),
                "router" => $this->getUrl('router.php'),
                "record_id" => REDCap::getRecordIdField(),
                "settings" => $json,
                "username" => ($this->getUser())->getUsername(),
                "eventMap" => $this->makeEventMap()
            ]);
        }

        // Pass down to JS
        $data = json_encode($data);
        echo "<script>Object.assign({$this->jsGlobal}, {$data});</script>";
    }

    /*
    Pass down sorting info and filter logic for the report. 
    The datatalbes API doesn't store inital sorting order.
    */
    private function loadReportDetails($report)
    {
        $details = DataExport::getReports($report);
        $logic =  json_encode($details["advanced_logic"] ?? $details["limiter_logic"]);
        $sort = [];
        foreach (range(1, 3) as $i) {
            $sort[] = [
                'field' => htmlentities($details["orderby_field$i"], ENT_QUOTES),
                'sort' => htmlentities($details["orderby_sort$i"], ENT_QUOTES)
            ];
        }
        $sort = json_encode($sort);
        echo "<script>{$this->jsGlobal}.logic = {$logic};</script>";
        echo "<script>{$this->jsGlobal}.sort = {$sort};</script>";
    }

    /*
    Pass down a mapping of report headers. Only way to do this in DataExport
    is by getting a full copy of the report
    */
    private function loadReportHeaders($report)
    {
        // Init some global values and constants
        global $Proj;
        $record_id = REDCap::getRecordIdField();
        $Proj->setRepeatingFormsEvents();
        $hasRepeatingFormsOrEvents = ($Proj->hasRepeatingEvents() || $Proj->hasRepeatingForms());
        $proj = (array)$Proj;

        // Grab the fields on the report
        $sql = '
            SELECT field_name FROM redcap_reports_fields 
            WHERE report_id = ? 
            AND isNull(limiter_group_operator) 
            ORDER BY field_order';
        $result = $this->query($sql, [$report]);

        // Flip through and build out our headers object
        $headers = [];
        $idx = 0;
        while ($row = $result->fetch_assoc()) {
            $name = $row["field_name"];
            $headers[$name] = [
                "index" => $idx++,
                "validation" => $proj["metadata"][$name]["element_validation_type"]
            ];
            if ($name != $record_id) continue;
            if ($proj["longitudinal"]) {
                $headers["redcap_event_name"] = [
                    "index" => $idx++,
                    "validation" => ""
                ];
            }
            if ($hasRepeatingFormsOrEvents) {
                $headers["redcap_repeat_instrument"] = [
                    "index" => $idx++,
                    "validation" => ""
                ];
                $headers["redcap_repeat_instance"] = [
                    "index" => $idx++,
                    "validation" => ""
                ];
            }
        }

        // Prep for export to JS
        $headers = array_merge(["record_id" => $headers[$record_id]], $headers);
        $formated = json_encode([
            "all" => $headers,
            "core" => [
                "record_id" => $headers[$record_id]["index"],
                "redcap_repeat_instrument" => $headers["redcap_repeat_instrument"]["index"],
                "redcap_repeat_instance" => $headers["redcap_repeat_instance"]["index"],
                "redcap_event_name" => $headers["redcap_event_name"]["index"]
            ]
        ]);
        echo "<script>{$this->jsGlobal}.headers = {$formated};</script>";
    }

    /*
    Pass down a list of all date(time) fields
    */
    private function includeDateFields()
    {
        global $Proj;
        $load = [];
        foreach ($Proj->metadata as $field => $data) {
            if (!empty($data["element_validation_type"]) && (strpos($data["element_validation_type"], "date") !== false)) {
                $load[] = $field;
            }
        }
        $load = json_encode($load);
        echo "<script>{$this->jsGlobal}.fields = {$load};</script>";
    }

    /*
    Util functions used by writeback. Creates a map of event display
    names to event ids.
    */
    private function makeEventMap()
    {
        $map = [];
        if (REDCap::isLongitudinal()) {
            $map = array_flip(REDCap::getEventNames(false));
            $map = $map + REDCap::getEventNames(true);
        }
        if (empty($map)) {
            $data = REDCap::getData('array', null, REDCap::getRecordIdField());
            $map[""] = !empty($data) ? reset(array_keys(reset($data))) : "";
        }
        return $map;
    }

    /*
    HTML to include some local JS file
    */
    private function includeJs($path)
    {
        echo "<script src={$this->getUrl('js/' .$path)}></script>";
    }

    /*
    HTML to include the local css file
    */
    private function includeCSS()
    {
        echo "<link rel='stylesheet' href={$this->getURL('style.css')}>";
    }
}
