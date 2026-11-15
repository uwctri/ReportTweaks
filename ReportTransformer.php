<?php

namespace UWMadison\ReportTweaks;

use REDCap;

class ReportTransformer
{
    private ReportTweaks $module;

    private const CORE_COLUMNS = [
        'redcap_event_name',
        'redcap_repeat_instrument',
        'redcap_repeat_instance',
        'redcap_data_access_group',
        'redcap_survey_identifier',
    ];

    public function __construct(ReportTweaks $module)
    {
        $this->module = $module;
    }

    /*
     * Transform a CSV string according to Report Tweaks settings.
     * Returns ['headers' => string[], 'rows' => string[][], 'csv' => string].
     */
    public function transformCsv(string $csv, array $settings, string $recordIdField = '', string $delimiter = ','): array
    {
        $parsed = $this->parseCsv($csv, $delimiter);
        $headers = $parsed['headers'];
        $rows = $parsed['rows'];

        if (empty($headers) || empty($rows)) {
            return ['headers' => $headers, 'rows' => $rows, 'csv' => $csv];
        }

        if (empty($recordIdField)) {
            $recordIdField = REDCap::getRecordIdField() ?: $headers[0];
        }

        $colIndex = array_flip($headers);
        $idIdx = $colIndex[$recordIdField] ?? 0;
        $eventIdx = $colIndex['redcap_event_name'] ?? null;
        $instIdx = $colIndex['redcap_repeat_instrument'] ?? null;
        $instNumIdx = $colIndex['redcap_repeat_instance'] ?? null;

        $coreIndices = [$idIdx];
        foreach (self::CORE_COLUMNS as $coreCol) {
            if (isset($colIndex[$coreCol])) {
                $coreIndices[] = $colIndex[$coreCol];
            }
        }
        $coreLookup = array_flip($coreIndices);

        // 1. Remove empty rows (if enabled)
        if (!empty($settings['removeEmpty'])) {
            $rows = $this->removeEmptyRows($rows, $coreLookup);
        }

        // 2. Copy core (non-repeating) row values to repeating rows (if enabled)
        if (!empty($settings['fillCore'])) {
            $rows = $this->fillCoreToRepeat(
                $rows,
                $idIdx,
                $eventIdx,
                $instIdx,
                $coreLookup,
                !empty($settings['dropCoreRows'])
            );
        }

        // 3. Reshape rows: 'wide_pivot', 'merge' (or legacy settings.merge), or 'none'
        $reshapeMode = $settings['reshapeMode'] ?? (!empty($settings['merge']) ? 'merge' : 'none');

        if ($reshapeMode === 'merge') {
            $rows = $this->mergeDisjointRows($rows, $idIdx, $coreLookup);
        } elseif ($reshapeMode === 'wide_pivot') {
            $pivoted = $this->pivotWide($headers, $rows, $idIdx, $eventIdx, $instIdx, $instNumIdx, $coreLookup);
            $headers = $pivoted['headers'];
            $rows = $pivoted['rows'];
        }

        // 4. Strip hidden REDCap columns if requested
        $dropCols = [];
        if (isset($settings['includeEvent']) && !$settings['includeEvent']) {
            $dropCols[] = 'redcap_event_name';
        }
        if (!empty($settings['hideRepeatExport'])) {
            $dropCols[] = 'redcap_repeat_instrument';
            $dropCols[] = 'redcap_repeat_instance';
        }

        if (!empty($dropCols)) {
            $filtered = $this->dropColumns($headers, $rows, $dropCols);
            $headers = $filtered['headers'];
            $rows = $filtered['rows'];
        }

        return [
            'headers' => $headers,
            'rows' => $rows,
            'csv' => $this->buildCsv($headers, $rows, $delimiter),
        ];
    }

    private function removeEmptyRows(array $rows, array $coreLookup): array
    {
        $out = [];
        foreach ($rows as $row) {
            $hasData = false;
            foreach ($row as $idx => $val) {
                if (isset($coreLookup[$idx])) continue;
                if ($val !== '') {
                    $hasData = true;
                    break;
                }
            }
            if ($hasData) $out[] = $row;
        }
        return $out;
    }

    private function fillCoreToRepeat(
        array $rows,
        int $idIdx,
        ?int $eventIdx,
        ?int $instIdx,
        array $coreLookup,
        bool $dropCoreRows
    ): array {
        if ($instIdx === null) return $rows;

        $grouped = $this->groupByRecord($rows, $idIdx);
        $out = [];

        foreach ($grouped as $recordRows) {
            $globalCore = [];
            $eventCore = [];
            $hasRepeat = false;

            foreach ($recordRows as $row) {
                $isRepeat = ($row[$instIdx] ?? '') !== '';
                if ($isRepeat) {
                    $hasRepeat = true;
                    continue;
                }
                $ev = $eventIdx !== null ? ($row[$eventIdx] ?? '') : '';
                foreach ($row as $idx => $val) {
                    if (isset($coreLookup[$idx]) || $val === '') continue;
                    if (!isset($globalCore[$idx])) $globalCore[$idx] = $val;
                    if ($ev !== '' && !isset($eventCore[$ev][$idx])) $eventCore[$ev][$idx] = $val;
                }
            }

            foreach ($recordRows as $row) {
                $isRepeat = ($row[$instIdx] ?? '') !== '';
                if (!$isRepeat) {
                    if (!$dropCoreRows || !$hasRepeat) {
                        $out[] = $row;
                    }
                    continue;
                }

                $ev = $eventIdx !== null ? ($row[$eventIdx] ?? '') : '';
                $source = ($ev !== '' && isset($eventCore[$ev])) ? ($eventCore[$ev] + $globalCore) : $globalCore;

                foreach ($source as $idx => $val) {
                    if (($row[$idx] ?? '') === '') {
                        $row[$idx] = $val;
                    }
                }
                $out[] = $row;
            }
        }

        return $out;
    }

    private function mergeDisjointRows(array $rows, int $idIdx, array $coreLookup): array
    {
        $grouped = $this->groupByRecord($rows, $idIdx);
        $out = [];

        foreach ($grouped as $recordRows) {
            $mergedList = [];
            foreach ($recordRows as $row) {
                $placed = false;
                foreach ($mergedList as $mIdx => $existing) {
                    $candidate = $this->tryMergeRow($existing, $row, $coreLookup);
                    if ($candidate !== null) {
                        $mergedList[$mIdx] = $candidate;
                        $placed = true;
                        break;
                    }
                }
                if (!$placed) {
                    $mergedList[] = $row;
                }
            }
            foreach ($mergedList as $mRow) {
                $out[] = $mRow;
            }
        }

        return $out;
    }

    private function tryMergeRow(array $rowA, array $rowB, array $coreLookup): ?array
    {
        $merged = $rowA;
        $count = count($rowA);
        for ($i = 0; $i < $count; $i++) {
            $a = $rowA[$i] ?? '';
            $b = $rowB[$i] ?? '';
            if (isset($coreLookup[$i])) {
                if ($a === '' && $b !== '') $merged[$i] = $b;
                continue;
            }
            if ($a === '') {
                $merged[$i] = $b;
            } elseif ($b !== '' && $a !== $b) {
                return null;
            }
        }
        return $merged;
    }

    /*
     * Collapse all rows for each record_id into one wide row.
     * Non-conflicting fields stay in their original column; fields with multiple
     * values across events/instances are pivoted into <field>__<context> columns.
     */
    private function pivotWide(
        array $headers,
        array $rows,
        int $idIdx,
        ?int $eventIdx,
        ?int $instIdx,
        ?int $instNumIdx,
        array $coreLookup
    ): array {
        $grouped = $this->groupByRecord($rows, $idIdx);

        // First pass: determine which columns ever have >1 distinct value or repeat instances for any record
        $multiCols = [];
        foreach ($grouped as $recordRows) {
            if (count($recordRows) <= 1) continue;
            foreach ($headers as $idx => $name) {
                if (isset($coreLookup[$idx])) continue;
                $seen = [];
                foreach ($recordRows as $row) {
                    $val = $row[$idx] ?? '';
                    if ($val !== '') $seen[] = $val;
                }
                if (count(array_unique($seen)) > 1) {
                    $multiCols[$idx] = true;
                }
            }
        }

        // Build output headers: record_id + single-value cols + dynamic pivoted cols
        $baseHeaders = [$headers[$idIdx]];
        $singleIndices = [];
        foreach ($headers as $idx => $name) {
            if (isset($coreLookup[$idx]) || isset($multiCols[$idx])) continue;
            $baseHeaders[] = $name;
            $singleIndices[] = $idx;
        }

        $pivotColMap = []; // pivotHeader => true
        $recordData = [];  // recordId => [header => val]

        foreach ($grouped as $recId => $recordRows) {
            $entry = [$headers[$idIdx] => $recId];

            foreach ($singleIndices as $idx) {
                $colName = $headers[$idx];
                $entry[$colName] = '';
                foreach ($recordRows as $row) {
                    if (($row[$idx] ?? '') !== '') {
                        $entry[$colName] = $row[$idx];
                        break;
                    }
                }
            }

            $occurrenceCounter = [];
            foreach ($recordRows as $row) {
                $suffixParts = [];
                if ($eventIdx !== null && ($row[$eventIdx] ?? '') !== '') {
                    $suffixParts[] = $this->sanitizeSuffix($row[$eventIdx]);
                }
                if ($instIdx !== null && ($row[$instIdx] ?? '') !== '') {
                    $instName = $this->sanitizeSuffix($row[$instIdx]);
                    $instNum = $instNumIdx !== null ? ($row[$instNumIdx] ?? '') : '';
                    $suffixParts[] = $instNum !== '' ? "{$instName}_{$instNum}" : $instName;
                }
                $baseSuffix = implode('__', $suffixParts);

                foreach ($multiCols as $idx => $_) {
                    $val = $row[$idx] ?? '';
                    if ($val === '') continue;

                    $fieldName = $headers[$idx];
                    $suffix = $baseSuffix !== '' ? $baseSuffix : 'row';
                    $key = "{$fieldName}__{$suffix}";

                    if (isset($entry[$key])) {
                        $occurrenceCounter[$key] = ($occurrenceCounter[$key] ?? 1) + 1;
                        $key = "{$key}_{$occurrenceCounter[$key]}";
                    }

                    $entry[$key] = $val;
                    $pivotColMap[$key] = true;
                }
            }

            $recordData[] = $entry;
        }

        $finalHeaders = array_merge($baseHeaders, array_keys($pivotColMap));
        $finalRows = [];
        foreach ($recordData as $entry) {
            $row = [];
            foreach ($finalHeaders as $h) {
                $row[] = $entry[$h] ?? '';
            }
            $finalRows[] = $row;
        }

        return ['headers' => $finalHeaders, 'rows' => $finalRows];
    }

    private function sanitizeSuffix(string $val): string
    {
        $clean = preg_replace('/[^a-zA-Z0-9]+/', '_', trim($val));
        return trim($clean, '_');
    }

    private function groupByRecord(array $rows, int $idIdx): array
    {
        $grouped = [];
        foreach ($rows as $row) {
            $id = $row[$idIdx] ?? '';
            $grouped[$id][] = $row;
        }
        return $grouped;
    }

    private function dropColumns(array $headers, array $rows, array $dropNames): array
    {
        $dropSet = array_flip($dropNames);
        $keepIndices = [];
        $newHeaders = [];

        foreach ($headers as $idx => $name) {
            if (isset($dropSet[$name])) continue;
            $keepIndices[] = $idx;
            $newHeaders[] = $name;
        }

        if (count($keepIndices) === count($headers)) {
            return ['headers' => $headers, 'rows' => $rows];
        }

        $newRows = [];
        foreach ($rows as $row) {
            $newRow = [];
            foreach ($keepIndices as $idx) {
                $newRow[] = $row[$idx] ?? '';
            }
            $newRows[] = $newRow;
        }

        return ['headers' => $newHeaders, 'rows' => $newRows];
    }

    private function parseCsv(string $csv, string $delimiter = ','): array
    {
        if (str_starts_with($csv, "\xEF\xBB\xBF")) {
            $csv = substr($csv, 3);
        }

        $fp = fopen('php://temp', 'r+');
        fwrite($fp, $csv);
        rewind($fp);

        $headers = fgetcsv($fp, 0, $delimiter, '"', '');
        if ($headers === false) {
            fclose($fp);
            return ['headers' => [], 'rows' => []];
        }

        $rows = [];
        $colCount = count($headers);
        while (($row = fgetcsv($fp, 0, $delimiter, '"', '')) !== false) {
            if ($row === [null]) continue;
            if (count($row) < $colCount) {
                $row = array_pad($row, $colCount, '');
            }
            $rows[] = $row;
        }

        fclose($fp);
        return ['headers' => $headers, 'rows' => $rows];
    }

    private function buildCsv(array $headers, array $rows, string $delimiter = ','): string
    {
        $fp = fopen('php://temp', 'r+');
        fputcsv($fp, $headers, $delimiter, '"', '');
        foreach ($rows as $row) {
            fputcsv($fp, $row, $delimiter, '"', '');
        }
        rewind($fp);
        $out = stream_get_contents($fp);
        fclose($fp);
        return $out === false ? '' : $out;
    }
}
