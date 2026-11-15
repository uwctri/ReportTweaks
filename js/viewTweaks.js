$(document).ready(() => {
    let templates = {};
    const isMdyDate = RegExp('[0-9]{2}-[0-9]{2}-[0-9]{4}');
    const module = ExternalModules.UWMadison.ReportTweaks;
    const localStorageKey = "RedcapReportTweaks";

    /*
    Utility function to add days to a date
    */
    const addDays = (date, days) => {
        let newDate = new Date(date.valueOf());
        newDate.setDate(date.getDate() + days);
        return newDate;
    }

    const setupCollapse = () => {
        const desc = $("#this_report_description");
        console.log("hit")
        if ((desc.length < 1) || (desc.height() < 160) || desc.hasClass("report_collapse"))
            return;
        desc.addClass("report_collapse");
        desc.after(templates.rtShowDescription);
        $("#rtShowDescription").on("click", () => {
            $("#rtShowDescription").hide();
            desc.addClass("report_show");
        });
    }

    /*
    Manipulate DOM to insert the Copy Button regardless
    of report format.
    */
    const insertCopyBtn = () => {
        let html = templates.rtCopyDataBtn;
        if ($(".report_pagenum_div").length) { // Pagination
            $(".report_pagenum_div").first().before(html);
        } else { // One Page
            $("#report_table_wrapper").prepend(html);
            $("#rtCopyDataBtn").css('float', 'left');
        }
        $("#rtCopyDataBtn").popover({
            content: module.tt("popover"),
            trigger: "hover"
        });
        $("#rtCopyDataBtn").on("click", copyData);
    }

    /*
    Manipulate DOM to insert the config checkboxes for hiding
    Event and Redcap repeat vars and date range filter. Hides
    either after insert if they are not able to be used.
    */
    const insertToggleFilters = () => {

        // Insert into the DOM
        $("#report_div .d-print-none").eq(1).css("width", "32em").append(templates.rtCheckboxes);

        // Hide some checkboxes if needed
        let keys = Object.keys(module.headers.core);
        if (!keys.includes('redcap_repeat_instrument')) {
            $("#hideRepeatCols").prop('disabled', true).prop('checked', false).parent().hide();
        }
        if (!keys.includes('redcap_event_name')) {
            $("#hideEventCol").prop('disabled', true).prop('checked', false).parent().hide();
        }

        // Hide the date range filter if needed
        let field = module.settings.dateField;
        let enable = module.settings.dateRange;
        if (!enable || !field || !Object.keys(module.headers.all).includes(field)) {
            $("#filterDateRange").parent().hide();
        }

        // Add events to toggle col visibility
        let fn = module.fn;
        $("#hideRepeatCols").on('click', (el) => toggleRepeatCols(!el.currentTarget.checked));
        $("#hideEventCol").on('click', (el) => toggleEventCol(!el.currentTarget.checked));

        // No need to add an event for the date range filter, its already handled in rangeSearch
        let table = $("#report_table").DataTable();
        if (table.data().any()) {
            $('#filterDateRange').on('change', table.draw);
        }
    }

    /*
    Performs very minor DOM manipulations to make the default search box
    and the enable/disable floating headers button appear uniform with the 
    new range search boxes at the top of report.
    */
    const insertFilters = () => {

        // HTML Setup
        $(".dataTables-rc-searchfilter-parent").css('width', '100%');
        $(".dataTables-rc-searchfilter-parent .col-sm-6").first().remove();
        $(".dataTables-rc-searchfilter-parent .col-sm-6").removeClass('col-sm-6').addClass('col-12 mt-1');
        $("#report_table_filter input").css('margin-right', '3px');
        $("#report_table_filter").prepend(templates.rtFilters);

        // Populate the pivot drop down
        let dropdown = $('#minmaxpivot');
        Object.keys(module.headers.all).forEach((el) => dropdown.append(new Option(el, el)));

        // Add the search function
        $.fn.dataTable.ext.search.push(rangeSearch);

        // Perform the search when any of the new fields are used
        let table = $("#report_table").DataTable();
        $('#minmaxpivot').on('change', () => table.draw());
        $('#tableFilterMin, #tableFilterMax').on('keyup change', () => table.draw());
    }

    /*
    Normalize legacy _wb formats (single object, flat array, or '^' chained items)
    into [{ modalBtn, modalText, footer, targets: [...] }].
    */
    const normalizeWbButtons = (raw) => {
        if (!raw) return [];
        const arr = Array.isArray(raw) ? raw : [raw];
        const buttons = [];

        arr.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            if (Array.isArray(item.targets)) {
                buttons.push(item);
                return;
            }
            const target = {
                event: item.event || '',
                fieldType: item.fieldType || 'static',
                fieldName: item.fieldName || item.field || '',
                fieldMap: item.fieldMap || {},
                writeType: item.writeType || 'ask',
                writeStatic: item.writeStatic || '',
                overwrites: !!item.overwrites,
                increment: !!item.increment
            };
            if (item.modalBtn === '^' && buttons.length > 0) {
                buttons[buttons.length - 1].targets.push(target);
            } else if (item.modalBtn) {
                buttons.push({
                    modalBtn: item.modalBtn,
                    modalText: item.modalText || '',
                    footer: item.footer || '',
                    targets: [target]
                });
            }
        });
        return buttons;
    };

    const formatLocalYmd = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const parseYmdLocal = (ymd) => {
        const [y, m, d] = (ymd || '').split('-').map(Number);
        if (!y || !m || !d) return new Date();
        return new Date(y, m - 1, d);
    };

    /*
    Inserts write back buttons below the live filters.
    */
    const insertWriteback = () => {
        const buttons = normalizeWbButtons(module.settings['_wb']);
        module.wbButtons = buttons;
        module.writeCount = buttons.length;

        buttons.forEach((btn, idx) => {
            if (!btn.modalBtn) return;
            $("#report_div .d-print-none").eq(1).append(
                templates.rtModalBtn
                    .replace('BtnLabel', htmlDecode(btn.modalBtn))
                    .replace('BtnNumber', idx)
            );
        });
        $(".tweaks_writeback").on("click", (el) => openModal(el));
    }

    /*
    Inserts a button along side the StatsCharts/ExportData/PrintPage/EditREport buttons.
    Toggles the display of the report's filter logic.
    */
    const insertReportLogic = () => {
        let text = module.logic
        if (!text) return;
        $("#report_div .d-print-none div").first().append(templates.rtLogic.replace('BtnLabel', module.tt("logic")));
        $("#this_report_title").after(templates.rtLogicDisplay.replace('LogicText', text));
        $("#rtLogic").on("click", () => $("#rtLogicDisplay").css("width", $("#report_table").css("width")).collapse('toggle'));
    }

    /*
    Extract plain record ID text whether cell is an <a> element or plain text.
    */
    const extractRecordId = (cellHtml) => {
        const $el = $('<div>').html(cellHtml ?? '');
        return $el.text().trim().split(/\s+/)[0] || '';
    };

    /*
    Gathers data for every visible row for a single target rule.
    */
    const packageTargetData = (target, askValues = {}) => {
        let writeObject = {};
        let table = $("#report_table").DataTable();
        let counter = 0;
        let counterDay = parseYmdLocal(today);
        let baseValue = target.writeStatic ?? '';
        let type = target.writeType;
        let baseField = target.fieldName || target.field || '';

        if (type === "today") {
            baseValue = today;
        } else if (type === "username") {
            baseValue = module.username;
        } else if (type === "ask") {
            baseValue = askValues[baseField] ?? $(`#rt_ask_${baseField}`).val() ?? '';
        }

        let writeIsInt = $.isNumeric(baseValue) && Math.floor(baseValue) == baseValue;

        table.rows().every(function () {
            if (!$(this.node()).is(':visible')) return;

            let rowVal = baseValue;
            if (target.increment) {
                if (type === "today") {
                    rowVal = formatLocalYmd(counterDay);
                } else if (writeIsInt) {
                    rowVal = (Number(baseValue) + counter).toString();
                }
                counter++;
                counterDay.setDate(counterDay.getDate() + 1);
            }

            const data = this.data();
            const record = extractRecordId(data[module.headers.core['record_id']]);
            if (!record) return;

            const rawEventCell = module.headers.core['redcap_event_name'] !== undefined ? data[module.headers.core['redcap_event_name']] : '';
            let eventid = module.eventMap[rawEventCell] ?? "";
            let instrument = module.headers.core['redcap_repeat_instrument'] !== undefined ? (data[module.headers.core['redcap_repeat_instrument']] ?? "") : "";
            let instance = module.headers.core['redcap_repeat_instance'] !== undefined ? (data[module.headers.core['redcap_repeat_instance']] ?? "") : "";

            let targetField = baseField;
            if (target.fieldType === "map" && target.fieldMap) {
                const eventUniqueName = module.eventMap[eventid] ?? rawEventCell;
                targetField = target.fieldMap[eventUniqueName] ?? target.fieldMap[rawEventCell] ?? baseField;
            }
            if (!targetField) return;

            if (target.event) {
                eventid = target.event;
                instrument = "";
                instance = "";
            }

            writeObject[targetField] ??= [];
            writeObject[targetField].push({
                record: record,
                event: eventid,
                instrument: instrument,
                instance: instance,
                val: rowVal,
                field: targetField,
                overwrite: !!target.overwrites
            });
        });
        return writeObject;
    };

    const mergePayloads = (targets, askValues = {}) => {
        const merged = {};
        targets.forEach((t) => {
            const part = packageTargetData(t, askValues);
            Object.entries(part).forEach(([field, list]) => {
                merged[field] ??= [];
                merged[field].push(...list);
            });
        });
        return merged;
    };

    const toTitleCase = (str) => {
        return (str || '').replace(/[_-]/g, ' ').replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
    };

    const htmlDecode = (input) => {
        var doc = new DOMParser().parseFromString(input || '', "text/html");
        return doc.documentElement.textContent;
    };

    /*
    Checks report, configuration, runs pre-flight preview, and displays writeback modal.
    */
    const openModal = async (event) => {
        const btnNumber = Number($(event.currentTarget).data("btn-count"));
        const btnConfig = (module.wbButtons || [])[btnNumber];
        const defaults = { icon: 'info', iconHtml: "<i class='fas fa-database'></i>" };

        if (!btnConfig || !Array.isArray(btnConfig.targets) || btnConfig.targets.length === 0) {
            Swal.fire({ icon: 'error', title: module.tt("modal_view_5"), html: module.tt("modal_view_6") });
            return;
        }

        if (!$.fn.DataTable.isDataTable('#report_table') || !$("#report_table").DataTable().rows({ filter: 'applied' }).count()) {
            Swal.fire({ ...defaults, title: module.tt("modal_view_1"), html: module.tt("modal_view_2") });
            return;
        }

        if (!isNumeric(module.headers.core['record_id'])) {
            Swal.fire({
                ...defaults,
                title: module.tt("modal_view_3"),
                html: module.tt("modal_view_4").replace('_', module.record_id),
            });
            return;
        }

        const invalidTarget = btnConfig.targets.find((t) => !(t.fieldName || t.field) && (!t.fieldType || t.fieldType === 'static'));
        if (invalidTarget) {
            Swal.fire({ icon: 'error', title: module.tt("modal_view_5"), html: module.tt("modal_view_6") });
            return;
        }

        // Run batched pre-flight preview
        const previewPayload = mergePayloads(btnConfig.targets);
        let previewHtml = '';
        try {
            const preview = await module.ajax('writeback_preview', { writeArray: previewPayload });
            if (preview && !preview.success && preview.warnings?.length) {
                Swal.fire({ icon: 'warning', title: module.tt("modal_view_13"), html: preview.warnings.join('<br>') });
                return;
            }
            if (preview && preview.success) {
                previewHtml = `
                    <div class="alert alert-light border text-left fs12 mt-2 mb-2 py-2 px-3">
                        <div><strong>Records affected:</strong> ${preview.uniqueRecords} (${preview.willWrite} cell writes)</div>
                        <div><strong>Fields:</strong> ${(preview.fields || []).join(', ') || 'None'}</div>
                        ${preview.skippedExisting ? `<div><strong>Skipped (already populated):</strong> ${preview.skippedExisting}</div>` : ''}
                        ${preview.skippedInvalidEvent ? `<div><strong>Skipped (invalid event for field):</strong> ${preview.skippedInvalidEvent}</div>` : ''}
                    </div>
                `;
            }
        } catch (e) {
            console.warn('Writeback preview failed, continuing to modal:', e);
        }

        let modalHtml = htmlDecode(btnConfig.modalText) + previewHtml;
        const askTargets = btnConfig.targets.filter((t) => t.writeType === 'ask');
        const seenAskFields = new Set();
        askTargets.forEach((t) => {
            const f = t.fieldName || t.field;
            if (!f || seenAskFields.has(f)) return;
            seenAskFields.add(f);
            modalHtml += templates.rtModalInput
                .replace('LabelText', toTitleCase(f))
                .replace('newID', `rt_ask_${f}`) + '&nbsp;';
        });

        const result = await Swal.fire({
            icon: 'question',
            title: module.tt("modal_view_9"),
            html: modalHtml,
            footer: htmlDecode(btnConfig.footer),
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#d33',
            confirmButtonText: module.tt("modal_view_10"),
            preConfirm: () => {
                const vals = {};
                seenAskFields.forEach((f) => { vals[f] = $(`#rt_ask_${f}`).val(); });
                return vals;
            }
        });

        if (!result.value) return;

        const finalPayload = mergePayloads(btnConfig.targets, result.value);
        try {
            let data = await module.ajax('writeback_execute', { writeArray: finalPayload });
            if (typeof data === 'string') data = JSON.parse(data);

            if ((data.warnings && data.warnings.length) || (data.errors && data.errors.length)) {
                let warningText = (data.warnings || []).concat(data.errors || []).join(', ');
                Swal.fire({
                    icon: 'warning',
                    title: module.tt("modal_view_13"),
                    html: `${module.tt("modal_view_14")}<br>${module.tt("modal_view_15")}: ${warningText}`
                });
            } else {
                const count = Object.keys(data.ids || {}).length;
                const done = await Swal.fire({
                    icon: 'success',
                    title: module.tt("modal_view_16"),
                    text: module.tt("modal_view_17").replace('_', count),
                    showCancelButton: true,
                    confirmButtonText: 'Refresh Report',
                    cancelButtonText: 'Close'
                });
                if (done.value) {
                    location.reload();
                }
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: module.tt("modal_view_11"),
                text: module.tt("modal_view_12"),
            });
        }
    };

    /*
    Datatables search function to find values between to points. Points
    can be alpha, numeric, or dates.
    */
    const rangeSearch = (settings, data, dataIndex) => {

        let min, max, field;
        let days = Number($("#filterDateRange").val());

        // Prioritize the drop down over the search
        if (module.settings.dateRange && days > 0) {
            min = addDays(new Date(today), -days).toISOString().split('T')[0];
            max = today;
            field = module.settings.dateField;
        } else {
            min = $('#tableFilterMin').val();
            max = $('#tableFilterMax').val();
            field = $('#minmaxpivot').val() || "";

            // Parse any non-ymd dates to ymd
            min = isNumeric(min) ? Number(min) : isMdyDate.test(min) ? date_mdy2ymd(min.replaceAll('/', '-')) : min;
            max = isNumeric(max) ? Number(max) : isMdyDate.test(max) ? date_mdy2ymd(max.replaceAll('/', '-')) : max;
        }

        // Gather the data for the row
        let datum = data[module.headers.all[field]?.index] || 0;
        datum = field == module.record_id ? datum.split(' ')[0] : datum;

        // Col data could be non-ymd
        datum = isNumeric(datum) ? Number(datum) : isMdyDate.test(datum) ? date_mdy2ymd(datum.replaceAll('/', '-')) : datum;

        // Apply filter
        return (
            (min === "" && max === "") ||
            (field === "") ||
            (min === "" && datum <= max) ||
            (min <= datum && max === "") ||
            (min <= datum && datum <= max)
        )
    }

    /*
    Copy all visible data from the report including headers to the user's clipboard as a 
    tab deliminted sheet that can be easily pasted into excel or other software.
    Doesn't use Datatables API.
    */
    const copyData = () => {

        // Find all visible headers and get the field name
        let headers = $("#report_table th:visible :last-child").filter('div').map((_, el) => $(el).text()).get();

        // For every cell organize it into our matrix/grid
        let data = $("#report_table td:visible").map((index, value) => {
            const prefix = index % headers.length == 0 ? '\n' : '';
            return prefix + $(value).text();
        });

        // Stuff into the clipboard after inserting delimeters
        navigator.clipboard.writeText(headers.join('\t') + data.get().join('\t'));
    }

    /*
    Trigger server-side transformed CSV download using the options from REDCap's Export Data modal.
    */
    const triggerTweakedExport = (formParams) => {
        const reportId = module.getUrlParameter('report_id');
        Swal.fire({
            title: 'Generating Tweaked Export...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        module.ajax('export_report', {
            report_id: reportId,
            formParams: formParams,
            hideRepeatExport: $("#hideRepeatCols").is(':checked'),
            includeEvent: !$("#hideEventCol").is(':checked') && !!module.settings.includeEvent
        }).then((res) => {
            Swal.close();
            if (!res || !res.success) {
                Swal.fire('Export Error', res?.error || 'Unable to export report.', 'error');
                return;
            }
            const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = res.filename || `report_${reportId}_tweaked.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }).catch((err) => {
            Swal.close();
            console.error('Report Tweaks export error:', err);
            Swal.fire('Export Error', err?.message || 'An unexpected error occurred while exporting.', 'error');
        });
    };

    /*
    Hook REDCap's native Export Data modal: add an "Export tweaked data" checkbox
    and intercept the normal Export Data button when checked for CSV exports.
    */
    const hookExportModal = () => {
        if (module.exportHooked) return;
        module.exportHooked = true;

        $(document).on('dialogopen', '#exportFormatDialog', function () {
            const $dlg = $(this);

            if (!$dlg.find('#rtExportTweaksOption').length) {
                const checkboxHtml = `
                    <fieldset id="rtExportTweaksOption" style="margin:15px 0;border:1px solid #bbb;background-color:#eee;">
                        <legend style="padding:5px 3px;margin-left:15px;color:#800000;font-weight:bold;font-size:15px;">
                            Report Tweaks
                        </legend>
                        <div style="padding:5px 15px 10px 15px;">
                            <label style="cursor:pointer;margin-bottom:4px;">
                                <input type="checkbox" id="rtApplyTweaksExport" name="rt_apply_tweaks" style="vertical-align:middle;margin-right:6px;" checked>
                                <span style="font-weight:bold;font-size:13px;vertical-align:middle;">Export tweaked data</span>
                            </label>
                            <div style="margin-left:22px;font-size:11px;line-height:14px;color:#444;">
                                Apply Report Tweaks reshaping, core-row fill, and column settings. Applies to CSV Raw and CSV Labels exports using the options selected below.
                            </div>
                        </div>
                    </fieldset>
                `;
                const $fieldset = $dlg.find('#export_format_fieldset');
                if ($fieldset.length) {
                    $fieldset.before(checkboxHtml);
                } else {
                    $dlg.find('#exportFormatForm').prepend(checkboxHtml);
                }

                $dlg.on('change.rtExport', 'input[name="export_format"]', () => {
                    const fmt = $dlg.find('input[name="export_format"]:checked').val();
                    const isCsv = fmt === 'csvraw' || fmt === 'csvlabels';
                    $dlg.find('#rtApplyTweaksExport').prop('disabled', !isCsv);
                    if (!isCsv) $dlg.find('#rtApplyTweaksExport').prop('checked', false);
                });
            }

            // Wrap the dialog's Export Data button (last button) if not already wrapped
            const buttons = $dlg.dialog('option', 'buttons');
            if (Array.isArray(buttons) && buttons.length > 1 && !buttons[buttons.length - 1]._rtWrapped) {
                const origBtn = buttons[buttons.length - 1];
                const origClick = origBtn.click;
                origBtn.click = function () {
                    const useTweaks = $dlg.find('#rtApplyTweaksExport').is(':checked');
                    const fmt = $dlg.find('input[name="export_format"]:checked').val();
                    if (useTweaks && (fmt === 'csvraw' || fmt === 'csvlabels')) {
                        if (typeof exportFormatDialogSaveValidate === 'function' && !exportFormatDialogSaveValidate()) {
                            simpleDialog(typeof langSaveValidate !== 'undefined' ? langSaveValidate : 'Please complete required fields.', typeof langError !== 'undefined' ? langError : 'Error');
                            return;
                        }
                        const formParams = $('form#exportFormatForm').serializeObject();
                        $dlg.dialog('close');
                        triggerTweakedExport(formParams);
                        return;
                    }
                    return origClick.apply(this, arguments);
                };
                origBtn._rtWrapped = true;
                $dlg.dialog('option', 'buttons', buttons);
            }
        });
    };

    /*
    Apply server-side reshaping (merge, wide_pivot, fillCore, removeEmpty) to #report_table.
    Replaces DataTable contents cleanly across all records (avoids pagination boundary bugs).
    */
    const applyServerTransformToTable = async () => {
        const s = module.settings || {};
        const reshapeMode = s.reshapeMode || (s.merge ? 'merge' : 'none');
        const needsTransform = reshapeMode !== 'none' || !!s.fillCore || !!s.removeEmpty;
        if (!needsTransform) return;

        const reportId = module.getUrlParameter('report_id');
        try {
            const res = await module.ajax('get_transformed_report', { report_id: reportId });
            if (!res || !res.success || !Array.isArray(res.headers)) return;

            const $table = $("#report_table");
            if ($.fn.DataTable.isDataTable($table)) {
                $table.DataTable().destroy();
            }

            const escapeHtml = (str) => $('<div>').text(str ?? '').html();

            const theadHtml = '<tr>' + res.headers.map(h => `<th><div>${escapeHtml(h)}</div></th>`).join('') + '</tr>';
            const tbodyHtml = res.rows.map(row =>
                '<tr>' + row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('') + '</tr>'
            ).join('');

            $table.find('thead').html(theadHtml);
            $table.find('tbody').html(tbodyHtml);

            // Rebuild header index map so column toggles, range filter, and writeback stay accurate
            const newAll = {};
            res.headers.forEach((name, idx) => {
                newAll[name] = {
                    index: idx,
                    validation: module.headers.all[name]?.validation || ''
                };
            });
            module.headers.all = newAll;
            module.headers.core = {};
            ['record_id', module.record_id, 'redcap_event_name', 'redcap_repeat_instrument', 'redcap_repeat_instance'].forEach((k) => {
                const key = k === module.record_id ? 'record_id' : k;
                if (newAll[k] !== undefined) {
                    module.headers.core[key] = newAll[k].index;
                }
            });

            // Re-populate range filter dropdown with updated headers
            const $pivot = $('#minmaxpivot');
            if ($pivot.length) {
                $pivot.find('option:not(:first)').remove();
                res.headers.forEach((h) => $pivot.append(new Option(h, h)));
            }

            $table.DataTable({
                paging: res.rows.length > 500,
                pageLength: 500,
                order: []
            });

            $("#report_div span").first().text(res.rows.length);
            if (!module.settings.includeEvent) {
                toggleEventCol(false);
            }
            if ($("#hideRepeatCols").is(':checked')) {
                toggleRepeatCols(false);
            }
        } catch (err) {
            console.error('Report Tweaks transform error:', err);
        }
    };

    /*
    Toggle Column visibility for redcap_repeat_columns.
    */
    const toggleRepeatCols = (show) => {
        let table = $("#report_table").DataTable();
        let keys = Object.keys(module.headers.core);
        if (keys.includes('redcap_repeat_instrument')) {
            table.column(module.headers.core['redcap_repeat_instrument']).visible(show);
        }
        if (keys.includes('redcap_repeat_instance')) {
            table.column(module.headers.core['redcap_repeat_instance']).visible(show);
        }
        updateTableWidth();
    }

    /*
    Toggle Column visibility for event name column.
    */
    const toggleEventCol = (show) => {
        if (!Object.keys(module.headers.core).includes('redcap_event_name')) {
            return;
        }
        let table = $("#report_table").DataTable();
        table.column(module.headers.core['redcap_event_name']).visible(show);
        updateTableWidth();
    }

    /*
    CSS Tweaking function to resolve odd width behavior.
    Ideally this would be resolved via CSS and this func removed.
    */
    const updateTableWidth = () => {
        // Updates the width of the page Selector above the table OR the filter area when 1 page
        if ($(".report_pagenum_div").length) {
            $(".report_pagenum_div").css('width', $("#report_table").css('width'));
        } else {
            $("#report_table_filter").css('width', Number($("#report_table").css('width').replace('px', '')) - 30 + 'px');
        }
        moveTableHeadersToggle();
    }

    /*
    Update the current report settings and return them
    */
    const updateStorage = (event = false) => {
        let storage = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
        const report = module.getUrlParameter('report_id');
        storage[report] ??= {
            hideEventCol: !!module.defaultHideEvent,
            hideRepeatCols: !!module.defaultHideRepeat
        };
        if (event) { // if called as an event
            $("#rtCheckboxes input").each((_, el) => { storage[report][$(el).attr('id')] = $(el).is(':checked') });
            localStorage.setItem(localStorageKey, JSON.stringify(storage));
        }
        return storage[report];
    }

    /*
    DOM Tweak for display of the "enable/disable" floating headers button
    for consistancy. 
    */
    const moveTableHeadersToggle = () => {

        // Wait for load
        if (!$("#FixedTableHdrsEnable").length) {
            window.requestAnimationFrame(moveTableHeadersToggle);
            return;
        }

        // Link hasn't been moved
        if (!$("#FixedTableHdrsEnable").hasClass('ReportTweaksAdjusted')) {
            // Multi page report or Single Page tweak
            if ($(".report_pagenum_div").length) {
                $("#FixedTableHdrsEnable").insertAfter('#rtCopyDataBtn').addClass('ReportTweaksAdjusted');
            } else {
                $("#FixedTableHdrsEnable").prependTo('#report_table_filter').addClass('ReportTweaksAdjusted');
            }
        }

        // Multi page report tweak for sizing
        if ($(".report_pagenum_div").length) {
            $("#FixedTableHdrsEnable").css('margin-left', Number($(".report_pagenum_div").css('width').replace('px', '')) - 170 + 'px');
        }
    }

    /*
    Wait for page to finish loading the report before deploying our tweaks.
    Full build out of the EM occurs here, we re-invoke if changing pages
    on a multipage report. 
    */
    const waitForLoad = () => {

        if ($("#report_table thead").length == 0 ||
            !$.fn.DataTable.isDataTable("#report_table")) { // Still Loading
            window.requestAnimationFrame(waitForLoad);
            if (module.settings.collapse) {
                setupCollapse()
            }
            return;
        }

        if ($("#rtCopyDataBtn").length) { // Stop double loading on animation lag
            return;
        }

        // Filter out any null values
        module.headers.core = Object.fromEntries(Object.entries(module.headers.core).filter(pair => isInteger(pair[1])));

        // Build checkboxes & hook Export Data modal
        insertCopyBtn();
        insertToggleFilters();
        insertFilters();
        hookExportModal();

        // Load Report Config (server-side reshaping replaces old JS mergeRows/removeEmptyRows)
        applyServerTransformToTable();
        if (module.settings.reportLogic) {
            insertReportLogic();
        }
        if (!module.settings.includeEvent) {
            toggleEventCol(false);
            $("#hideEventCol").prop('disabled', true).prop('checked', false).parent().hide();
        }
        if (module.settings.writeback) {
            insertWriteback();
        }
        if (module.settings.collapse) {
            setupCollapse()
        }

        // Setup localStorage Saving
        const storage = updateStorage();
        $.each(storage, (key, value) => { if (value) $(`#${key}:enabled`).click() });
        $("#rtCheckboxes input").on('click', updateStorage);
    }

    /*
    Watch for state history change (used on multi-page reports)
    We can't avoid polling due to page changing using history push state
    */
    let oldHref = document.location.href;
    let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (oldHref != document.location.href) {
                oldHref = document.location.href;
                waitForLoad();
            }
        });
    });
    observer.observe(document.querySelector("body"), {
        childList: true,
        subtree: true
    });

    // Load HTML Tempates and start load
    $.each($("template[id=ReportTweaks]").prop('content').children, (_, el) =>
        templates[$(el).prop('id')] = $(el).prop('outerHTML'));
    waitForLoad();
});