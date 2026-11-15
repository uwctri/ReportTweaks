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

        // Perform the search when any of the new feilds are used
        let table = $("#report_table").DataTable();
        $('#minmaxpivot, #tableFilterMin, #tableFilterMax').keyup(table.draw);
    }

    /*
    Inserts buttons below the live filters or write back buttons if they
    are configured.
    Undocumented behavior - Skip buttons with name "^" as it means that
    the action of that button should trigger when the previous one is
    clicked.
    */
    const insertWriteback = () => {
        const insert = (btnName) => {
            $("#report_div .d-print-none").eq(1).append(
                templates.rtModalBtn.replace('BtnLabel',
                    htmlDecode(btnName)).replace('BtnNumber',
                        module.writeCount));
        }
        module.writeCount = 0;
        const settings = module.settings['_wb'];
        if (settings.modalBtn) {
            module.writeCount = 1;
            insert(settings.modalBtn)
        }
        else if (settings.length > 0) {
            settings.forEach((el) => {
                if (el.modalBtn && el.modalBtn != "^") {
                    insert(el.modalBtn)
                    module.writeCount += 1;
                }
            })
        }
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
    Gathers data for every row in preperation for a write back.
    Finds event and repeating instrument/instance if it exists.
    Also handles write value calculation, if any.
    */
    const packageData = (settings) => {
        let writeObject = {};
        let table = $("#report_table").DataTable();
        let counter = 0;
        let counterDay = new Date(today);
        let writeValue = settings.writeStatic;
        let type = settings.writeType;
        let field = settings.fieldName || settings.field;

        if (type == "today") {
            writeValue = today;
        } else if (type == "username") {
            writeValue = module.username;
        } else if (type == "ask") {
            writeValue = $(`#${field}`).val();
        }

        let writeIsInt = $.isNumeric(writeValue) && Math.floor(writeValue) == writeValue;

        table.rows().every(function () {
            if (!$(this.node()).is(':visible')) return;

            if (settings.increment) {
                if (type == "today") {
                    writeValue = counterDay.toISOString().split('T')[0];
                } else if (writeIsInt) {
                    writeValue = (Number(writeValue) + counter).toString();
                }
                counter++;
                counterDay.setDate(counterDay.getDate() + 1);
            }

            const data = this.data();
            const record = $(data[module.headers.core['record_id']])[0].text;
            let eventid = module.eventMap[data[module.headers.core['redcap_event_name']]] ?? "";
            let instrument = data[module.headers.core['redcap_repeat_instrument']] ?? "";
            let instance = data[module.headers.core['redcap_repeat_instance']] ?? "";
            if (settings.fieldType == "map") {
                field = settings.fieldMap[module.eventMap[eventid]] ?? field;
            }
            if (settings.event) {
                eventid = settings.event;
                instrument = "";
                instance = "";
            }
            writeObject[field] ??= [];
            writeObject[field].push({
                record: record,
                event: eventid,
                instrument: instrument, // Always display name, mapped server side
                instance: instance,
                val: writeValue,
                field: field
            });
        });
        return writeObject;
    }

    /*
    Pretty formatting for displaying the field name being written to
    in write back modal
    */
    const toTitleCase = (str) => {
        return str.replace(/[_-]/g, ' ').replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
    }

    /*
    Safe decode for HTML strings sent from PHP
    */
    const htmlDecode = (input) => {
        var doc = new DOMParser().parseFromString(input, "text/html");
        return doc.documentElement.textContent;
    }

    /*
    Checks report, configuration, and if valid then generates/displays
    the write back modal to user. 
    */
    const openModal = (event) => {
        let btnNumber = $(event.currentTarget).data("btn-count");
        let settings = module.settings['_wb'];
        let newFormat = false;

        // Check for new settings format
        if (!settings.modalBtn) {
            settings = settings[btnNumber];
            newFormat = true;
        }

        const field = settings.fieldName || settings.field;
        const defaults = { icon: 'info', iconHtml: "<i class='fas fa-database'></i>" }

        // No records exist on the report
        if (!$.fn.DataTable.isDataTable('#report_table') ||
            !$("#report_table").DataTable().rows().count()) {
            Swal.fire({
                ...defaults,
                title: module.tt("modal_view_1"),
                html: module.tt("modal_view_2"),
            });
            return;
        }

        // Record ID is missing from the report
        if (!isNumeric(module.headers.core['record_id'])) {
            Swal.fire({
                ...defaults,
                title: module.tt("modal_view_3"),
                html: module.tt("modal_view_4").replace('_', module.record_id),
            });
            return;
        }

        // Bad configuration
        if (!field && [null, "static"].includes(settings.fieldType)) {
            Swal.fire({
                icon: 'error',
                title: module.tt("modal_view_5"),
                html: module.tt("modal_view_6"),
            });
            return;
        }

        // Write back has occured once already
        if (module.writeDone && module.writeCount == 1) {
            Swal.fire({
                ...defaults,
                title: module.tt("modal_view_7"),
                html: module.tt("modal_view_8"),
            });
            return;
        }

        // Build out modal text if needed
        let html = htmlDecode(settings.modalText);
        if (settings.writeType == 'ask') {
            html += templates.rtModalInput
                .replace('LabelText', toTitleCase(field))
                .replace('newID', field) + '&nbsp;';
        }

        // Display modal and handle response from server
        Swal.fire({
            icon: 'question',
            title: module.tt("modal_view_9"),
            html: html,
            footer: htmlDecode(settings.footer),
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#d33',
            confirmButtonText: module.tt("modal_view_10")
        }).then((result) => {
            if (!result.value) return;
            let payload = packageData(settings);
            if (newFormat) {
                for (let i = btnNumber + 1; i < module.settings['_wb'].length; i++) {
                    let local = module.settings['_wb'][i];
                    if (local.modalBtn == "^") {
                        payload = { ...payload, ...packageData(local) }
                        continue
                    }
                    break;
                }
            }
            if ("undefined" in payload) {
                delete payload["undefined"];
            }
            module.ajax('writeback_execute', {
                overwrite: !!settings.overwrites,
                writeArray: payload
            }).then((data) => {
                console.log(data);
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                module.writeDone = true;
                if ((data.warnings && data.warnings.length) || (data.errors && data.errors.length)) {
                    let warningText = (data.warnings || []).concat(data.errors || []).join(', ');
                    Swal.fire({
                        icon: 'warning',
                        title: module.tt("modal_view_13"),
                        html: `${module.tt("modal_view_14")}<br>${module.tt("modal_view_15")}: ${warningText}`
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: module.tt("modal_view_16"),
                        text: module.tt("modal_view_17").replace('_', Object.keys(data.ids || {}).length),
                    });
                }
            }).catch((err) => {
                console.error(err);
                Swal.fire({
                    icon: 'error',
                    title: module.tt("modal_view_11"),
                    text: module.tt("modal_view_12"),
                });
            });
        })
    }

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
    Trigger server-side transformed CSV download (raw or labels).
    */
    const triggerTweakedExport = (format = 'csvraw') => {
        const reportId = module.getUrlParameter('report_id');
        Swal.fire({
            title: 'Generating Tweaked Export...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        module.ajax('export_report', {
            report_id: reportId,
            format: format,
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
            console.error(err);
            Swal.fire('Export Error', 'An unexpected error occurred while exporting.', 'error');
        });
    };

    /*
    Insert tweaked CSV export buttons onto the report toolbar and hook REDCap's export modal.
    */
    const insertExportButtons = () => {
        if ($("#rtExportGroup").length) return;
        $("#report_div .d-print-none div").first().append(templates.rtExportGroup);
        $("#rtExportRaw").on('click', () => triggerTweakedExport('csvraw'));
        $("#rtExportLabels").on('click', () => triggerTweakedExport('csvlabels'));

        // Also inject a Report Tweaks export banner into REDCap's native Export Data dialog when opened
        $(document).on('dialogopen', '#exportFormatDialog', function () {
            const $dlg = $(this);
            if ($dlg.find('#rtNativeExportBanner').length) return;
            $dlg.prepend(`
                <div id="rtNativeExportBanner" class="alert alert-info py-2 px-3 mb-3 d-flex align-items-center justify-content-between">
                    <div>
                        <strong>Report Tweaks:</strong> Export with row merging, core-row fill, or wide flattening applied.
                    </div>
                    <div class="btn-group btn-group-sm ml-2">
                        <button type="button" class="btn btn-primary rt-native-export" data-fmt="csvraw">Tweaked CSV (Raw)</button>
                        <button type="button" class="btn btn-outline-primary rt-native-export" data-fmt="csvlabels">Tweaked CSV (Labels)</button>
                    </div>
                </div>
            `);
            $dlg.find('.rt-native-export').on('click', (e) => {
                const fmt = $(e.currentTarget).data('fmt');
                $dlg.dialog('close');
                triggerTweakedExport(fmt);
            });
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

        // Build checkboxes & export buttons
        insertCopyBtn();
        insertToggleFilters();
        insertFilters();
        insertExportButtons();

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