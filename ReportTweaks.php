<?php

namespace UWMadison\ReportTweaks;
use ExternalModules\AbstractExternalModule;
use ExternalModules\ExternalModules;
use REDCap;

class ReportTweaks extends AbstractExternalModule {
    
    private $module_global = 'ReportTweaks';
    private $cookieJS = "https://cdn.jsdelivr.net/npm/js-cookie@3.0.1/dist/js.cookie.min.js";
    
    public function redcap_every_page_top($project_id) {
        // Custom Config page
        if (strpos(PAGE, 'ExternalModules/manager/project.php') !== false && $project_id != NULL) {
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
    
    private function initGlobal() {
        $json = $this->getProjectSetting('json');
        $data = json_encode([
            "modulePrefix" => $this->PREFIX,
            "router" => $this->getUrl('router.php'),
            "record_id" => REDCap::getRecordIdField(),
            "settings" => empty($json) ? array() : (array)json_decode($json),
        ]);
        echo "<script>var {$this->module_global} = {$data};</script>";
    }
    
    private function includeCookies() {
        echo "<script type='text/javascript' src={$this->cookieJS}></script>";
    }
    
    private function includeJs($path) {
        echo "<script src={$this->getUrl($path)}></script>";
    }
}

?>
