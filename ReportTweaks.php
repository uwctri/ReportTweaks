<?php

namespace UWMadison\ReportTweaks;

use ExternalModules\AbstractExternalModule;
use REDCap;
use DataExport;

require_once __DIR__ . '/ReportTransformer.php';

class ReportTweaks extends AbstractExternalModule
{
    private string $jsGlobal = "";
    private array $defaultSettings = ['includeEvent' => true];
    private ?ReportTransformer $transformer = null;

    private function getTransformer(): ReportTransformer
    {
        if ($this->transformer === null) {
            $this->transformer = new ReportTransformer($this);
        }
        return $this->transformer;
    }

    /*
     * Primary REDCap hook: loads config and report page scripts.
     */
    public function redcap_every_page_top($project_id)
    {
        if (!defined("USERID")) return;

        $report_id = $_GET['report_id'] ?? null;

        if ($this->isPage('ExternalModules/manager/project.php') && $project_id) {
            $this->loadSettings($project_id);
            $this->includeJs('config.js');
            return;
        }

        if ($this->isPage('DataExport/index.php') && $project_id && ($report_id || !empty($_GET['create'])) && empty($_GET['stats_charts'])) {
            $this->loadSettings($project_id, $report_id);
            $this->includeCSS();
            include('templates.php');

            if (!empty($_GET['addedit'])) {
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
     * Native JSMO AJAX router.
     */
    public function redcap_module_ajax($action, $payload, $project_id, $record)
    {
        if (!defined("USERID") || empty($project_id)) {
            return ['success' => false, 'error' => 'Unauthorized'];
        }

        if ($action === 'save_report_config') {
            return $this->handleSaveReportConfig($project_id, $payload);
        }

        if ($action === 'export_report') {
            return $this->handleExportReport($project_id, $payload);
        }

        if ($action === 'get_transformed_report') {
            return $this->handleGetTransformedReport($project_id, $payload);
        }

        if ($action === 'writeback_execute') {
            return $this->handleWritebackExecute($project_id, $payload);
        }

        return ['success' => false, 'error' => 'Unknown action'];
    }

    /*
     * Save report-specific configuration via JSMO.
     */
    private function handleSaveReportConfig($project_id, array $payload): array
    {
        $report_id = $payload['report'] ?? null;
        if (empty($report_id) || !is_numeric($report_id)) {
            return ['success' => false, 'error' => 'Invalid report ID'];
        }

        if (!$this->canEditReport($project_id, (int)$report_id)) {
            return ['success' => false, 'error' => 'You do not have permission to edit this report.'];
        }

        $new = is_array($payload['settings'] ?? null)
            ? $payload['settings']
            : (json_decode((string)($payload['settings'] ?? '{}'), true) ?: []);

        if (!empty($new['_wb']) && is_array($new['_wb'])) {
            foreach ($new['_wb'] as $index => $data) {
                if (!is_array($data)) continue;
                foreach (['footer', 'modalBtn', 'modalText'] as $html) {
                    if (isset($data[$html])) {
                        $new['_wb'][$index][$html] = REDCap::escapeHtml($data[$html]);
                    }
                }
            }
        }

        $this->setProjectSetting("report_config_{$report_id}", json_encode($new), $project_id);
        return ['success' => true];
    }

    /*
     * Check if the current user can edit the specified report.
     */
    private function canEditReport($project_id, int $report_id): bool
    {
        $user = $this->getUser();
        if ($user->isSuperUser()) return true;

        $username = $user->getUsername();
        $rights = REDCap::getUserRights($username)[$username] ?? [];
        if (($rights['reports'] ?? '0') === '1') return true;

        $sql = "SELECT 1 FROM redcap_reports_edit_access_users WHERE report_id = ? AND username = ?";
        $res = $this->query($sql, [$report_id, $username]);
        if ($res->fetch_assoc()) return true;

        if (!empty($rights['role_id'])) {
            $sql = "SELECT 1 FROM redcap_reports_edit_access_roles WHERE report_id = ? AND role_id = ?";
            $res = $this->query($sql, [$report_id, $rights['role_id']]);
            if ($res->fetch_assoc()) return true;
        }

        return false;
    }

    /*
     * Load per-report configuration, migrating from legacy 'json' setting if needed.
     */
    public function getReportConfig($project_id, $report_id): array
    {
        if (empty($report_id)) return $this->defaultSettings;

        $perReport = $this->getProjectSetting("report_config_{$report_id}", $project_id);
        if (!empty($perReport)) {
            $decoded = json_decode($perReport, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $decoded;
            }
        }

        $legacyJson = $this->getProjectSetting('json', $project_id);
        if (!empty($legacyJson)) {
            $all = json_decode($legacyJson, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($all[$report_id]) && is_array($all[$report_id])) {
                $migrated = $all[$report_id];
                $this->setProjectSetting("report_config_{$report_id}", json_encode($migrated), $project_id);
                return $migrated;
            }
        }

        return $this->defaultSettings;
    }

    /*
     * Export a report as transformed CSV (raw or labels).
     */
    private function handleExportReport($project_id, array $payload): array
    {
        $report_id = $payload['report_id'] ?? null;
        if (empty($report_id) || (!is_numeric($report_id) && $report_id !== 'ALL')) {
            return ['success' => false, 'error' => 'Invalid report ID'];
        }

        $user = $this->getUser();
        $username = $user->getUsername();
        $rights = REDCap::getUserRights($username)[$username] ?? [];
        if (!$user->isSuperUser() && ($rights['data_export_tool'] ?? '0') === '0') {
            return ['success' => false, 'error' => 'You do not have data export rights.'];
        }

        $format = ($payload['format'] ?? 'csvraw') === 'csvlabels' ? 'csvlabels' : 'csvraw';
        $settings = $this->getReportConfig($project_id, $report_id);
        if (!empty($payload['hideRepeatExport'])) {
            $settings['hideRepeatExport'] = true;
        }
        if (isset($payload['includeEvent'])) {
            $settings['includeEvent'] = (bool)$payload['includeEvent'];
        }

        $rawCsv = DataExport::doReport(
            $report_id,
            'export',
            $format,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            [],
            [],
            false,
            false,
            false,
            false, // $storeInFileRepository = false -> returns CSV string
            true,
            $payload['liveFilterLogic'] ?? '',
            $payload['liveFilterGroupId'] ?? '',
            $payload['liveFilterEventId'] ?? '',
            false,
            ',',
            '',
            [],
            false,
            true,
            false,
            false,
            false,
            true,
            true,
            $project_id
        );

        if (!is_string($rawCsv)) {
            return ['success' => false, 'error' => 'Failed to generate report data.'];
        }

        $transformed = $this->getTransformer()->transformCsv($rawCsv, $settings, REDCap::getRecordIdField());
        $reportTitle = is_numeric($report_id) ? (DataExport::getReports($report_id)['title'] ?? "report_{$report_id}") : 'all_data';
        $safeTitle = preg_replace('/[^a-zA-Z0-9_-]+/', '_', $reportTitle);
        $suffix = $format === 'csvlabels' ? 'LABELS' : 'RAW';
        $filename = trim($safeTitle, '_') . "_tweaked_{$suffix}_" . date('Y-m-d_Hi') . ".csv";

        return [
            'success' => true,
            'csv' => $transformed['csv'],
            'filename' => $filename,
            'rowCount' => count($transformed['rows']),
        ];
    }

    /*
     * Return server-transformed report data for on-screen DataTable rendering.
     */
    private function handleGetTransformedReport($project_id, array $payload): array
    {
        $report_id = $payload['report_id'] ?? null;
        if (empty($report_id) || !is_numeric($report_id)) {
            return ['success' => false, 'error' => 'Invalid report ID'];
        }

        $settings = $this->getReportConfig($project_id, $report_id);
        $rawCsv = DataExport::doReport(
            $report_id,
            'export',
            'csvlabels',
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            [],
            [],
            false,
            false,
            false,
            false, // $storeInFileRepository = false -> returns CSV string
            true,
            $payload['liveFilterLogic'] ?? '',
            $payload['liveFilterGroupId'] ?? '',
            $payload['liveFilterEventId'] ?? '',
            false,
            ',',
            '',
            [],
            false,
            true,
            false,
            false,
            false,
            false, // doLoggingForExports = false for on-screen view
            false,
            $project_id
        );

        if (!is_string($rawCsv)) {
            return ['success' => false, 'error' => 'Failed to load report data.'];
        }

        // For on-screen view, keep event/repeat columns in payload so toggles & writeback still work
        $viewSettings = $settings;
        $viewSettings['includeEvent'] = true;
        $viewSettings['hideRepeatExport'] = false;

        $transformed = $this->getTransformer()->transformCsv($rawCsv, $viewSettings, REDCap::getRecordIdField());

        return [
            'success' => true,
            'headers' => $transformed['headers'],
            'rows' => $transformed['rows'],
        ];
    }

    /*
     * Perform a writeback from a report (temporary wrapper until Phase 3 rewrite).
     */
    private function handleWritebackExecute($project_id, array $payload): array
    {
        $writeBackData = is_array($payload['writeArray'] ?? null)
            ? $payload['writeArray']
            : (json_decode((string)($payload['writeArray'] ?? '[]'), true) ?: []);

        $saveType = 'array';
        $record_id_name = REDCap::getRecordIdField();
        $overwrite = filter_var($payload['overwrite'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $instrumentMap = array_flip(REDCap::getInstrumentNames());
        $writeArray = [];

        $user = $this->getUser()->getUsername();
        $rights = REDCap::getUserRights($user)[$user]['forms'] ?? [];
        $dd = REDCap::getDataDictionary($project_id, 'array');

        foreach ($writeBackData as $fieldName => $dataList) {
            $field = $fieldName;
            $form = $dd[$field]['form_name'] ?? '';
            if (empty($form) || !str_contains($rights[$form] ?? '', "1")) {
                return [
                    "form" => $form,
                    "warnings" => [$this->tt('warning_1')],
                    "errors" => [],
                ];
            }

            foreach ($dataList as $data) {
                $event = $data['event'] ?? '';
                $instrument = $instrumentMap[$data['instrument'] ?? ''] ?? "";
                $record = $data['record'] ?? '';
                $instance = $data['instance'] ?? "";

                if (REDCap::isLongitudinal() && (empty($event) || !in_array($field, REDCap::getValidFieldsByEvents($project_id, $event)))) {
                    continue;
                }

                if (!$overwrite) {
                    $existingData = REDCap::getData($project_id, 'array', $record, $field, $event)[$record] ?? [];
                    if (!empty($instrument)) {
                        if (!empty($existingData["repeat_instances"][$event][$instrument][$instance][$field])) {
                            continue;
                        }
                    } elseif (!empty($existingData[$event][$field])) {
                        continue;
                    }
                }

                if (!empty($instrument)) {
                    $writeArray[$record]["repeat_instances"][$event][$instrument][$instance][$field] = $data['val'];
                } elseif (empty($event)) {
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

        if (!empty($writeArray)) {
            return REDCap::saveData($project_id, $saveType, $writeArray, 'overwrite');
        }

        return [
            "warnings" => [$this->tt('warning_2')],
            "errors" => []
        ];
    }

    /*
     * Initializes the ReportTweaks JS module object and passes settings to the frontend.
     */
    private function loadSettings($project_id, $report = null): void
    {
        $this->initializeJavascriptModuleObject();
        $this->tt_transferToJavascriptModuleObject();
        $this->jsGlobal = $this->getJavascriptModuleObjectName();
        $data = ["prefix" => $this->getPrefix()];

        if (!empty($report)) {
            $settings = $this->getReportConfig($project_id, $report);
            $data = array_merge($data, [
                "isLong" => REDCap::isLongitudinal(),
                "record_id" => REDCap::getRecordIdField(),
                "settings" => $settings,
                "username" => $this->getUser()->getUsername(),
                "eventMap" => $this->makeEventMap(),
                "defaultHideEvent" => (bool)$this->getProjectSetting('default_hide_event', $project_id),
                "defaultHideRepeat" => (bool)$this->getProjectSetting('default_hide_repeat', $project_id),
            ]);
        }

        $encoded = json_encode($data, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        echo "<script>Object.assign({$this->jsGlobal}, {$encoded});</script>";
    }

    /*
     * Pass down sorting info and filter logic for the report.
     */
    private function loadReportDetails($report): void
    {
        $details = DataExport::getReports($report);
        $logic = json_encode(
            $details["advanced_logic"] ?? $details["limiter_logic"] ?? "",
            JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP
        );
        $sort = [];
        foreach (range(1, 3) as $i) {
            $sort[] = [
                'field' => htmlentities($details["orderby_field$i"] ?? '', ENT_QUOTES),
                'sort' => htmlentities($details["orderby_sort$i"] ?? '', ENT_QUOTES)
            ];
        }
        $sort = json_encode($sort, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        echo "<script>{$this->jsGlobal}.logic = {$logic};</script>";
        echo "<script>{$this->jsGlobal}.sort = {$sort};</script>";
    }

    /*
     * Pass down a mapping of report headers.
     */
    private function loadReportHeaders($report): void
    {
        global $Proj;
        $isLongitudinal = REDCap::isLongitudinal();
        $record_id = REDCap::getRecordIdField();

        $sql = 'SELECT report_display_include_repeating_fields AS re FROM redcap_reports WHERE report_id = ?';
        $result = $this->query($sql, [$report]);
        $row = $result->fetch_assoc();
        $hasRepeatingFormsOrEvents = ($row['re'] ?? '0') === '1';

        $sql = '
            SELECT field_name FROM redcap_reports_fields
            WHERE report_id = ?
            AND isNull(limiter_group_operator)
            ORDER BY field_order
        ';
        $result = $this->query($sql, [$report]);

        $headers = [];
        $idx = 0;
        while ($row = $result->fetch_assoc()) {
            $name = $row["field_name"];
            $headers[$name] = [
                "index" => $idx++,
                "validation" => $Proj->metadata[$name]["element_validation_type"] ?? ""
            ];
            if ($name !== $record_id) continue;
            if ($isLongitudinal) {
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

        if (isset($headers[$record_id])) {
            $headers = array_merge(["record_id" => $headers[$record_id]], $headers);
        }

        $formatted = json_encode([
            "all" => $headers,
            "core" => [
                "record_id" => $headers[$record_id]["index"] ?? null,
                "redcap_repeat_instrument" => $headers["redcap_repeat_instrument"]["index"] ?? null,
                "redcap_repeat_instance" => $headers["redcap_repeat_instance"]["index"] ?? null,
                "redcap_event_name" => $headers["redcap_event_name"]["index"] ?? null,
            ]
        ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        echo "<script>{$this->jsGlobal}.headers = {$formatted};</script>";
    }

    /*
     * Pass down a list of all date(time) fields.
     */
    private function includeDateFields(): void
    {
        global $Proj;
        $load = [];
        foreach ($Proj->metadata as $field => $data) {
            if (!empty($data["element_validation_type"]) && str_contains($data["element_validation_type"], "date")) {
                $load[] = $field;
            }
        }
        $load = json_encode($load, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        echo "<script>{$this->jsGlobal}.fields = {$load};</script>";
    }

    /*
     * Creates a map of event display names to event ids (and vice versa).
     */
    private function makeEventMap(): array
    {
        $map = [];
        if (REDCap::isLongitudinal()) {
            $map = array_flip(REDCap::getEventNames(false));
            $map = $map + REDCap::getEventNames(true);
        }
        if (empty($map)) {
            $data = REDCap::getData('array', null, REDCap::getRecordIdField());
            $firstRecord = !empty($data) ? reset($data) : [];
            $map[""] = !empty($firstRecord) ? array_key_first($firstRecord) : "";
        }
        return $map;
    }

    private function includeJs(string $path): void
    {
        echo "<script src=\"" . htmlspecialchars($this->getUrl("js/{$path}"), ENT_QUOTES) . "\"></script>";
    }

    private function includeCSS(): void
    {
        echo "<link rel=\"stylesheet\" href=\"" . htmlspecialchars($this->getUrl("style.css"), ENT_QUOTES) . "\">";
    }
}
