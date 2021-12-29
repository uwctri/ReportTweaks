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
        
        // Custom Config page
        if ( $this->isPage('ExternalModules/manager/project.php') && $project_id ) {
            $this->includePrefix();
            $this->includeJs('config.js');
        }
        
        // Reports Page (Edit or View Report, Not the all-reports page or stats/charts)
        elseif ( $this->isPage('DataExport/index.php') && $project_id && ($_GET['report_id'] || $_GET['create'] ) && !$_GET['stats_charts']) {
            $this->loadSettings($_GET['report_id']);
            $this->includeCSS();
            include('templates.php');
            if ( $_GET['addedit'] ) {
                $this->includeJs('editTweaks.js');
            } else {
                $this->includeCookies();
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
        $this->initializeJavascriptModuleObject();
        $this->tt_transferToJavascriptModuleObject();
        $json = ((array)json_decode( $this->getProjectSetting('json') ))[$report];
        $json = empty($json) ? $this->defaultSettings : $json;
        $data = json_encode([
            "isLong" => REDCap::isLongitudinal(),
            "csrf" => $this->getCSRFToken(),
            "router" => $this->getUrl('router.php'),
            "record_id" => REDCap::getRecordIdField(),
            "settings" => $json,
        ]);
        echo "<script>var {$this->module_global} = {$data};</script>";
        echo "<script> {$this->module_global}.em = {$this->getJavascriptModuleObjectName()}</script>";
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
    }
}

?>
