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
        $writeBackData = (array) json_decode($_POST['writeArray']);
        $dd = REDCap::getDataDictionary($pid,'array');
        $pid = $_GET['pid'];
        $field = $_POST['field'];
        $eventMap = $this->makeEventMap();
        $writeArray = [];
        
        // Loop over every line of the report we got back
        foreach ( $writeBackData as $data ) {
            
            // If we were sent a display name, swap it to an id
            $event = is_numeric($data['event']) ? $data['event'] : $eventMap[$data['event']];
            
            // Make sure field exists on event, shouldn't be an issue
            if (empty($event) || !in_array($field, REDCap::getValidFieldsByEvents($pid, $event))) {
                continue;
            }
            
            // If no overwritting then make sure we don't blow away data
            if ( !$data['overwrite'] ) {
                $existingData = REDCap::getData($pid, 'array', $data['record'], $field, $event);
                if( !empty($data['instrument']) && !$data['ignoreInstance'] && 
                    !empty($existingData[$data['record']]["repeat_instances"][$event][$data['instrument']][$data['instance']][$field])) {
                    continue;// Don't do write
                }
                elseif ( !empty($existingData[$data['record']][$event][$field]) ) {
                    continue; // Don't do write
                }
            }
            
            
            // Set value on repeat or single instrument
            if( !empty($data['instrument']) && !$data['ignoreInstance'] ) {
                $instrument = str_replace(' ', '_', $data['instrument']);
                $instrument = str_replace('-', '', $data['instrument']);
                
                if( $dd[$field]['form_name'] == $instrument ) {
                    $writeArray[$data['record']]["repeat_instances"][$event][$data['instrument']][$data['instance']][$field] = $data['val'];
                }
            } else {
                $writeArray[$data['record']][$event][$field] = $data['val'];
            }
        }
        return !empty($writeArray) ? REDCap::saveData($pid, 'array', $writeArray) : [];
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
    
    private function makeEventMap() {
        $map = [];
        foreach( REDCap::getEventNames(false) as $id => $display ){
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
