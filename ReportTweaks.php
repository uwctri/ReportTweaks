<?php

namespace UWMadison\ReportTweaks;

use ExternalModules\AbstractExternalModule;
use REDCap;
use DataExport;
use Throwable;

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

        if ($action === 'writeback_preview') {
            return $this->handleWritebackPreview($project_id, $payload);
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
        $hasExportRight = $user->isSuperUser()
            || !empty(array_filter($rights['forms_export'] ?? [], fn($v) => (string)$v !== '0'));
        if (!$hasExportRight) {
            return ['success' => false, 'error' => 'You do not have data export rights.'];
        }

        try {
            $formParams = is_array($payload['formParams'] ?? null) ? $payload['formParams'] : [];
            $format = ($formParams['export_format'] ?? $payload['format'] ?? 'csvraw') === 'csvlabels' ? 'csvlabels' : 'csvraw';

            $settings = $this->getReportConfig($project_id, $report_id);
            if (!empty($payload['hideRepeatExport'])) {
                $settings['hideRepeatExport'] = true;
            }
            if (isset($payload['includeEvent'])) {
                $settings['includeEvent'] = (bool)$payload['includeEvent'];
            }

            // Mirror REDCap's Export Data modal options
            global $Proj, $user_rights;
            $outputDags = empty($rights['group_id']) && ($formParams['export_groups'] ?? '') === 'on';
            $outputSurveyFields = ($formParams['export_survey_fields'] ?? '') === 'on';
            $hashRecordID = (!empty($Proj->table_pk_phi) && ($user_rights['forms_export'][$Proj->firstForm] ?? 0) > 1)
                || ($formParams['deid-hashid'] ?? '') === 'on';
            $removeIdentifierFields = ($formParams['deid-remove-identifiers'] ?? '') === 'on';
            $removeUnvalidatedTextFields = ($formParams['deid-remove-text'] ?? '') === 'on';
            $removeNotesFields = ($formParams['deid-remove-notes'] ?? '') === 'on';
            $removeDateFields = ($formParams['deid-dates-remove'] ?? '') === 'on';
            $dateShiftDates = !$removeDateFields && ($formParams['deid-dates-shift'] ?? '') === 'on';
            $dateShiftSurveyTimestamps = !$removeDateFields && ($formParams['deid-surveytimestamps-shift'] ?? '') === 'on';
            $returnBlankForGrayFormStatus = ($formParams['returnBlankForGrayFormStatus'] ?? '') === '1';

            $csvDelimiter = (isset($formParams['csvDelimiter']) && DataExport::isValidCsvDelimiter($formParams['csvDelimiter']))
                ? $formParams['csvDelimiter']
                : ',';
            if ($csvDelimiter === 'tab' || $csvDelimiter === 'TAB') $csvDelimiter = "\t";
            if ($csvDelimiter === 'SPACE') $csvDelimiter = " ";
            $decimalCharacter = $formParams['decimalCharacter'] ?? '';

            $liveFilterLogic = $payload['liveFilterLogic'] ?? '';
            $liveFilterGroupId = $payload['liveFilterGroupId'] ?? '';
            $liveFilterEventId = $payload['liveFilterEventId'] ?? '';
            if (($formParams['live_filters_apply'] ?? '') === 'on' && empty($liveFilterLogic)) {
                $lf = DataExport::buildReportDynamicFilterLogic($report_id);
                if (is_array($lf) && count($lf) >= 3) {
                    [$liveFilterLogic, $liveFilterGroupId, $liveFilterEventId] = $lf;
                }
            }

            $rawCsv = DataExport::doReport(
                $report_id,
                'export',
                $format,
                false,
                false,
                $outputDags,
                $outputSurveyFields,
                $removeIdentifierFields,
                $hashRecordID,
                $removeUnvalidatedTextFields,
                $removeNotesFields,
                $removeDateFields,
                $dateShiftDates,
                $dateShiftSurveyTimestamps,
                [],
                [],
                false,
                false,
                false,
                false, // $storeInFileRepository = false -> returns CSV string
                true,
                $liveFilterLogic,
                $liveFilterGroupId,
                $liveFilterEventId,
                false,
                $csvDelimiter,
                $decimalCharacter,
                [],
                false,
                true,
                false,
                false,
                $returnBlankForGrayFormStatus,
                true,
                true,
                $project_id
            );

            if (!is_string($rawCsv)) {
                return ['success' => false, 'error' => 'Failed to generate report data.'];
            }

            $transformed = $this->getTransformer()->transformCsv($rawCsv, $settings, REDCap::getRecordIdField(), $csvDelimiter);
            $csvOut = $transformed['csv'];
            if (function_exists('mb_convert_encoding')) {
                $csvOut = mb_convert_encoding($csvOut, 'UTF-8', 'UTF-8');
            }

            $reportTitle = is_numeric($report_id) ? (DataExport::getReports($report_id)['title'] ?? "report_{$report_id}") : 'all_data';
            $safeTitle = preg_replace('/[^a-zA-Z0-9_-]+/', '_', $reportTitle);
            $suffix = $format === 'csvlabels' ? 'LABELS' : 'RAW';
            $filename = trim($safeTitle, '_') . "_tweaked_{$suffix}_" . date('Y-m-d_Hi') . ".csv";

            return [
                'success' => true,
                'csv' => $csvOut,
                'filename' => $filename,
                'rowCount' => count($transformed['rows']),
            ];
        } catch (Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
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
     * Preview how many records/cells will be written vs skipped before executing.
     */
    private function handleWritebackPreview($project_id, array $payload): array
    {
        $plan = $this->prepareWritebackPlan($project_id, $payload);
        if (!empty($plan['deniedForms'])) {
            return [
                'success' => false,
                'warnings' => [$this->tt('warning_1') . ' (' . implode(', ', $plan['deniedForms']) . ')'],
                'errors' => [],
            ];
        }

        return [
            'success' => true,
            'willWrite' => $plan['willWrite'],
            'skippedExisting' => $plan['skippedExisting'],
            'skippedInvalidEvent' => $plan['skippedInvalidEvent'],
            'uniqueRecords' => count($plan['records']),
            'fields' => array_keys($plan['targetFields']),
        ];
    }

    /*
     * Perform a batched writeback from a report.
     */
    private function handleWritebackExecute($project_id, array $payload): array
    {
        $plan = $this->prepareWritebackPlan($project_id, $payload);
        if (!empty($plan['deniedForms'])) {
            return [
                'form' => implode(', ', $plan['deniedForms']),
                'warnings' => [$this->tt('warning_1')],
                'errors' => [],
            ];
        }

        if (empty($plan['writeArray'])) {
            return [
                'warnings' => [$this->tt('warning_2')],
                'errors' => [],
            ];
        }

        return REDCap::saveData($project_id, $plan['saveType'], $plan['writeArray'], 'overwrite');
    }

    /*
     * Validate permissions, batch-fetch existing data, and build the saveData payload.
     */
    private function prepareWritebackPlan($project_id, array $payload): array
    {
        $writeBackData = is_array($payload['writeArray'] ?? null)
            ? $payload['writeArray']
            : (json_decode((string)($payload['writeArray'] ?? '[]'), true) ?: []);

        $defaultOverwrite = filter_var($payload['overwrite'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $record_id_name = REDCap::getRecordIdField();
        $instrumentMap = array_flip(REDCap::getInstrumentNames());
        $isLongitudinal = REDCap::isLongitudinal();

        $user = $this->getUser();
        $username = $user->getUsername();
        $rights = REDCap::getUserRights($username)[$username]['forms'] ?? [];
        $dd = REDCap::getDataDictionary($project_id, 'array');

        $deniedForms = [];
        $targetFields = [];
        $recordSet = [];

        foreach ($writeBackData as $fieldName => $dataList) {
            $form = $dd[$fieldName]['form_name'] ?? '';
            if (empty($form) || (!$user->isSuperUser() && !str_contains($rights[$form] ?? '', '1'))) {
                $deniedForms[$form ?: $fieldName] = true;
                continue;
            }
            $targetFields[$fieldName] = true;
            foreach ($dataList as $data) {
                if (!empty($data['record'])) {
                    $recordSet[(string)$data['record']] = true;
                }
            }
        }

        if (!empty($deniedForms) || empty($recordSet) || empty($targetFields)) {
            return [
                'deniedForms' => array_keys($deniedForms),
                'targetFields' => $targetFields,
                'writeArray' => [],
                'saveType' => 'array',
                'willWrite' => 0,
                'skippedExisting' => 0,
                'skippedInvalidEvent' => 0,
                'records' => [],
            ];
        }

        // Batch-fetch existing data once instead of N+1 queries inside the row loop
        $existingAll = REDCap::getData($project_id, 'array', array_keys($recordSet), array_keys($targetFields));
        $validFieldsByEvent = [];

        $writeArray = [];
        $saveType = 'array';
        $willWrite = 0;
        $skippedExisting = 0;
        $skippedInvalidEvent = 0;
        $affectedRecords = [];

        foreach ($writeBackData as $field => $dataList) {
            foreach ($dataList as $data) {
                $event = $data['event'] ?? '';
                $instrument = $instrumentMap[$data['instrument'] ?? ''] ?? '';
                $record = (string)($data['record'] ?? '');
                $instance = $data['instance'] ?? '';
                $itemOverwrite = isset($data['overwrite']) ? (bool)$data['overwrite'] : $defaultOverwrite;

                if ($record === '') continue;

                if ($isLongitudinal) {
                    if (empty($event)) {
                        $skippedInvalidEvent++;
                        continue;
                    }
                    if (!isset($validFieldsByEvent[$event])) {
                        $validFieldsByEvent[$event] = array_flip(REDCap::getValidFieldsByEvents($project_id, $event));
                    }
                    if (!isset($validFieldsByEvent[$event][$field])) {
                        $skippedInvalidEvent++;
                        continue;
                    }
                }

                if (!$itemOverwrite) {
                    $recData = $existingAll[$record] ?? [];
                    if (!empty($instrument)) {
                        if (!empty($recData['repeat_instances'][$event][$instrument][$instance][$field])) {
                            $skippedExisting++;
                            continue;
                        }
                    } elseif (!empty($recData[$event][$field])) {
                        $skippedExisting++;
                        continue;
                    }
                }

                if (!empty($instrument)) {
                    $writeArray[$record]['repeat_instances'][$event][$instrument][$instance][$field] = $data['val'];
                } elseif (empty($event)) {
                    $saveType = 'json-array';
                    $writeArray[] = [
                        $record_id_name => $record,
                        $field => $data['val'],
                    ];
                } else {
                    $writeArray[$record][$event][$field] = $data['val'];
                }

                $willWrite++;
                $affectedRecords[$record] = true;
            }
        }

        return [
            'deniedForms' => [],
            'targetFields' => $targetFields,
            'writeArray' => $writeArray,
            'saveType' => $saveType,
            'willWrite' => $willWrite,
            'skippedExisting' => $skippedExisting,
            'skippedInvalidEvent' => $skippedInvalidEvent,
            'records' => $affectedRecords,
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
        $url = $this->getUrl("js/{$path}");
        $fullPath = $this->getModulePath() . "js/{$path}";
        if (file_exists($fullPath)) {
            $url .= (str_contains($url, '?') ? '&' : '?') . 'v=' . filemtime($fullPath);
        }
        echo "<script src=\"" . htmlspecialchars($url, ENT_QUOTES) . "\"></script>";
    }

    private function includeCSS(): void
    {
        $url = $this->getUrl("style.css");
        $fullPath = $this->getModulePath() . "style.css";
        if (file_exists($fullPath)) {
            $url .= (str_contains($url, '?') ? '&' : '?') . 'v=' . filemtime($fullPath);
        }
        echo "<link rel=\"stylesheet\" href=\"" . htmlspecialchars($url, ENT_QUOTES) . "\">";
    }
}
