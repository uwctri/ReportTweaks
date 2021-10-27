<?php

namespace UWMadison\ReportTweaks;
use ExternalModules\AbstractExternalModule;
use ExternalModules\ExternalModules;
use REDCap;

class ReportTweaks extends AbstractExternalModule {
    
    private $module_global = 'ReportTweaks';
    private $cookieJS = "https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js";
    private $defaultSettings = ['includeEvent'=>true];
    
    public function redcap_every_page_top($project_id) {
        // Custom Config page
        if (strpos(PAGE, 'manager/project.php') !== false && $project_id != NULL) {
            $this->initGlobal();
            $this->includeJs('config.js');
        }
        // Reports Page
        elseif (PAGE == 'DataExport/index.php' && $project_id != NULL && $_GET['report_id']) {
            $this->initGlobal();
            if ( $_GET['addedit'] ) {
                $this->includeJs('editTweaks.js');
            } else {
                $this->includeCookies();
                $this->includeJs('viewTweaks.js');
            }
        }
    }
    
    public function saveReportConfig() {
        $json = $this->getProjectSetting('json');
        $json = empty($json) ? array() : (array)json_decode($json);
        $json[$_POST['report']] = json_decode($_POST['settings']);
        ExternalModules::setProjectSetting($this->PREFIX, $_GET['pid'], 'json', json_encode($json));
    }
    
    public function reportWrite() {
        // Gather info
        $writeBackData = (array) json_decode($_POST['writeArray'],true);
        $dd = REDCap::getDataDictionary($pid,'array');
        $pid = $_GET['pid'];
        $field = $_POST['field'];
        $overwrite = json_decode($_POST['overwrite']);
        $eventMap = $this->makeEventMap($pid);
        $instrumentMap = $this->makeInstrumentMap();
        $writeArray = [];
        
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
                if( $dd[$field]['form_name'] == $instrument ) {
                    $writeArray[$record]["repeat_instances"][$event][$instrument][$instance][$field] = $data['val'];
                }
            } else {
                $writeArray[$record][$event][$field] = $data['val'];
            }
        }
        return json_encode(!empty($writeArray) ? REDCap::saveData($pid, 'array', $writeArray) : ["warnings"=>["No data to write"]]);
    }
    
    private function initGlobal() {
        $json = $this->getProjectSetting('json');
        $data = json_encode([
            "modulePrefix" => $this->PREFIX,
            "router" => $this->getUrl('router.php'),
            "record_id" => REDCap::getRecordIdField(),
            "defaultSettings" => $this->defaultSettings,
            "settings" => empty($json) ? array() : (array)json_decode($json),
        ]);
        echo "<script>var {$this->module_global} = {$data};</script>";
    }
    
    private function makeEventMap($project_id) {
        $map = [];
        foreach( REDCap::getEventNames(false) as $id => $display ){
            $map[$display] = $id;
        }
        if ( empty($map) ) {
            $map[""] = reset(array_keys(reset(REDCap::getData($project_id,'array', null, REDCap::getRecordIdField()))));
        }
        return $map;
    }
    
    private function makeInstrumentMap() {
        $map = [];
        foreach (REDCap::getInstrumentNames() as $id=>$display) {
            $map[$display] = $id;
        }
        return $map;
    }
    
    private function includeCookies() {
        echo "<script type='text/javascript' src={$this->cookieJS}></script>";
    }
    
    private function includeJs($path) {
        echo "<script src={$this->getUrl($path)}></script>";
    }
}

?>
