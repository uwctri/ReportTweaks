ReportTweaks.fn = {};
ReportTweaks.cookie = {};

/*
Manipulate DOM to insert the Copy Button regardless
of report format.
*/
ReportTweaks.fn.insertCopyBtn = function() {
    let html = ReportTweaks.html.rtCopyDataBtn;
    if ($(".report_pagenum_div").length) { // Pagination
        $(".report_pagenum_div").first().before(html);
    } else { // One Page
        $("#report_table_wrapper").prepend(html);
        $("#rtCopyDataBtn").css('float', 'left');
    }
    $("#rtCopyDataBtn").popover({
        content: "Copy data below to clipboard",
        trigger: "hover"
    });
    $("#rtCopyDataBtn").on("click", ReportTweaks.fn.copyData);
}

/*
Manipulate DOM to insert the config checkboxes for hiding
Event and Redcap repeat vars. Hides the boxes after insert
if they are not able to be used.
*/
ReportTweaks.fn.insertCheckboxes = function() {

    // Insert into the DOM
    $("#report_div .d-print-none").eq(1).append(ReportTweaks.html.rtCheckboxes);
    if (!Number.isInteger(ReportTweaks.coreColumnMap['redcap_repeat_instrument'])) {
        $("#hideRepeatCols").prop('disabled', true).prop('checked', false).parent().hide();
    }
    if (!Number.isInteger(ReportTweaks.coreColumnMap['redcap_event_name'])) {
        $("#hideEventCol").prop('disabled', true).prop('checked', false).parent().hide();
    }

    // Add events to toggle col visibility
    let fn = ReportTweaks.fn;
    $("#hideRepeatCols").on('click', function() { fn.toggleRepeatCols(!this.checked) });
    $("#hideEventCol").on('click', function() { fn.toggleEventCol(!this.checked) });
}

/*
Performs very minor DOM manipulations to make the default search box
and the enable/disable floating headers button appear uniform with the 
new range search boxes at the top of report.
*/
ReportTweaks.fn.insertFilters = function() {
    $(".dataTables-rc-searchfilter-parent").css('width', '100%');
    $(".dataTables-rc-searchfilter-parent .col-sm-6").first().remove();
    $(".dataTables-rc-searchfilter-parent .col-sm-6").removeClass('col-sm-6').addClass('col-12 mt-1');
    $("#report_table_filter input").css('margin-right', '3px');
    $("#report_table_filter").prepend(ReportTweaks.html.rtFilters);
    $.fn.dataTable.ext.search.push(ReportTweaks.fn.rangeSearch);
}

/*
Inserts buttons below the live filters or write back buttons if they
are configured.
*/
ReportTweaks.fn.insertWriteback = function() {
    $("#report_div .d-print-none").eq(1).append(
        ReportTweaks.html.rtModalBtn.replace('BtnLabel',
            ReportTweaks.settings[ReportTweaks.em.getUrlParameter('report_id')]['_wb'].modalBtn));
    $(".tweaks_writeback").on("click", ReportTweaks.fn.openModal);
}

/*
Gathers data for every row in preperation for a write back.
Finds event and repeating instrument/instance if it exists.
Also handles write value calculation, if any.
*/
ReportTweaks.fn.packageData = function() {
    let writeArray = [];
    let table = $("#report_table").DataTable();
    let settings = ReportTweaks.settings[ReportTweaks.em.getUrlParameter('report_id')]['_wb'];
    let counter = 0;
    let counterDay = new Date(today);

    table.rows().every(function() {
        if (!$(this.node()).is(':visible'))
            return;
        let data = this.data();
        let writeValue = settings.writeStatic;
        let type = settings.writeType;

        if (type == "today") {
            writeValue = today;
        } else if (type == "ask") {
            writeValue = $(`#${settings.field}`).val();
        }

        if (settings.increment) {
            if (type == "today") {
                writeValue = counterDay.toISOString().split('T')[0];
            } else {
                writeValue = (Number(writeValue) + counter).toString();
            }
            counter++;
            counterDay.setDate(counterDay.getDate() + 1);
        }

        let record = $(data[ReportTweaks.coreColumnMap[ReportTweaks.record_id]])[0].text;
        let eventid = settings.event || data[ReportTweaks.coreColumnMap['redcap_event_name']] || "";
        let instrument = data[ReportTweaks.coreColumnMap['redcap_repeat_instrument']] || "";
        let instance = data[ReportTweaks.coreColumnMap['redcap_repeat_instance']] || "";
        writeArray.push({
            'record': record,
            'event': eventid, // Can be event id or display name
            'instrument': instrument, // Always display name, mapped server side
            'instance': instance,
            'val': writeValue,
        });
    });
    return writeArray;
}

/*
Pretty formatting for displaying the field name being written to
in write back modal
*/
ReportTweaks.fn.toTitleCase = function(str) {
    return str.replace(/[_-]/g, ' ').replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
}

/*
Checks report, configuration, and if valid then generates/displays
the write back modal to user. 
*/
ReportTweaks.fn.openModal = function() {
    let settings = ReportTweaks.settings[ReportTweaks.em.getUrlParameter('report_id')]['_wb'];
    let defaults = { icon: 'info', iconHtml: "<i class='fas fa-database'></i>" }

    // No records exist on the report
    if (!$.fn.DataTable.isDataTable('#report_table') ||
        !$("#report_table").DataTable().rows().count()) {
        Swal.fire({...defaults,
            title: "No Records",
            html: "Nothin' to do boss",
        });
        return;
    }

    // Record ID is missing from the report
    if (!isNumeric(ReportTweaks.coreColumnMap[ReportTweaks.record_id])) {
        Swal.fire({...defaults,
            title: "No Record ID",
            html: `You must include ${ReportTweaks.record_id} on your report to write back to the database.`,
        });
        return;
    }

    // Bad configuration
    if (!settings.field) {
        Swal.fire({...defaults,
            title: "No Write Field Defined",
            html: "Please review the writeback configuration and define a field that should be written to.",
        });
        return;
    }

    // Write back has occured once already
    if (ReportTweaks.writeDone) {
        Swal.fire({...defaults,
            title: "Already Written",
            html: "You've already written once to the database. \
                   Please refresh the page before writing again.",
        });
        return;
    }

    // Build out modal text if needed
    let html = settings.modalText;
    if (settings.writeType == 'ask') {
        html += ReportTweaks.html.rtModalInput
            .replace('LabelText', ReportTweaks.fn.toTitleCase(settings.field))
            .replace('newID', settings.field) + '&nbsp;';
    }

    // Display modal and handle response from server
    Swal.fire({
        icon: 'question',
        title: 'Are you sure?',
        html: html,
        footer: settings.footer,
        showCloseButton: true,
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Write to DB'
    }).then((result) => {
        if (!result.value) {
            return;
        }
        $.ajax({
            method: 'POST',
            url: ReportTweaks.router,
            data: {
                route: 'reportWrite',
                field: settings.field,
                overwrite: !!settings.overwrites, // encoded as "true" or "false" string
                writeArray: JSON.stringify(ReportTweaks.fn.packageData())
            },
            error: (jqXHR, textStatus, errorThrown) => {
                console.log(`${jqXHR}\n${textStatus}\n${errorThrown}`);
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: "There was an issue writing back to the database." +
                        "If possible, leave this window open and contact a RedCap Administrator"
                });
            },
            success: (data) => {
                // Expected Reuturn value format - 
                // {"errors":[],"warnings":[],"ids":{"5512":"5512"},"item_count":2} OR
                // {"warnings":["No data to write"]
                console.log(data);
                data = JSON.parse(data);
                ReportTweaks.writeDone = true;
                if (data.warnings.length || data.errors.length) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Possible Issue',
                        text: "There was an issue writing back to the database." +
                            "If possible, leave this window open and contact a RedCap Administrator"
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Write Back Complete',
                        text: `Data was successfully written to ${Object.keys(data.ids).length} records`,
                    });
                }
            }
        });
    })
}

/*
Datatables search function to find values between to points. Points
can be alpha, numeric, or dates.
*/
ReportTweaks.fn.rangeSearch = function(settings, data, dataIndex) {
    let min = $('#tableFilterMin').val();
    let max = $('#tableFilterMax').val();
    let target = $('#minmaxpivot').val() || "";
    let pivot = data[$("#report_table th").index($(`th:contains(${target})`))] || 0;

    min = isNumeric(min) ? Number(min) : isDate(min, 'm-d-y') ? date_mdy2ymd(min.replaceAll('/', '-')) : min;
    max = isNumeric(max) ? Number(max) : isDate(max, 'm-d-y') ? date_mdy2ymd(max.replaceAll('/', '-')) : max;
    pivot = isNumeric(pivot) ? Number(pivot) : isDate(pivot, 'm-d-y') ? date_mdy2ymd(pivot.replaceAll('/', '-')) : pivot;

    if ((min === "" && max === "") ||
        (target === "") ||
        (min === "" && pivot <= max) ||
        (min <= pivot && max === "") ||
        (min <= pivot && pivot <= max))
        return true;
    return false;
}

/*
Copy all visible data from the report including headers to the user's clipboard as a 
tab deliminted sheet that can be easily pasted into excel or other software.
Doesn't use Datatables API.
*/
ReportTweaks.fn.copyData = function() {

    // Find all visible headers and get the field name
    let headers = $("#report_table th:visible :last-child").filter('div').map(function() {
        return $(this).text();
    });

    // For every cell organize it into our matrix/grid
    let data = $("#report_table td:visible").map(function(index, value) {
        if (index % headers.length == 0)
            return '\n' + $(value).text();
        return $(value).text();
    });

    // Stuff into the clipboard after inserting delimeters
    navigator.clipboard.writeText(headers.get().join('\t') + data.get().join('\t'));
}

/*
Copy all visible data from the report including headers to the user's clipboard as a 
tab deliminted sheet that can be easily pasted into excel or other software.
Doesn't use Datatables API.
*/
ReportTweaks.fn.mergeRows = function() {

    // check if we have a record id column, if so be sure its sorted
    let recordCol = $(`#report_table th:contains(${ReportTweaks.record_id})`);
    if (!recordCol.length) {
        return;
    }
    if ($(recordCol).index() != 0 && !$(recordCol).hasClass('sorting_asc')) {
        $(recordCol).click();
    }
    recordCol = $(recordCol).index();

    // Setup for loop
    let prev = -1;
    let table = $("#report_table").DataTable();
    let remove = [];

    // Loop over all rows in the table
    table.rows().every(function(rowIdx, tableLoop, rowLoop) {

        // Check to see if this and prev row match
        // If not, bail and go to next row
        let row = this.data();
        let id = $(row[0]).text().split(' ')[0].trim();
        if (id != prev) { prev = id; return; }
        prev = id;

        // Map all current and previous row data so we can compare display values
        // Merge the two and if successful continue 
        let currData = $.map(row, (value, key) => typeof value == "string" ? value : value['display']);
        let prevData = $.map(table.row(rowIdx - 1).data(), (value, key) => typeof value == "string" ? value : value['display']);
        let newData = ReportTweaks.fn.mergeArray(currData, prevData);
        if (!newData) {
            return;
        }

        // Populate the row with the merged data and remove
        // any bad styling. Skip spots where no new data exists
        $(this.node()).find("td").each(function(index, el) {
            if (newData[index] == null) {
                return;
            }
            $(el).removeClass('nodesig');
            if ($(el).html() != newData[index]) {
                table.cell(rowIdx, index).data(newData[index]);
            }
        });

        // Save the node to our remove list
        remove.push(table.row(rowIdx - 1).node());
    });

    // Review and trash rows that have been merged into others, update
    remove.forEach((row) => table.row(row).remove());
    $("#report_div span").first().text(table.rows().count()); // count
    table.draw();

    // Loop over every column to find those with dates in them, 
    // we only walk down a col until we find a non-blank so this
    // doesn't take much time
    let buildCache = [];
    let isAnyDate = RegExp('[0-9]{2,4}-[0-9]{2}-[0-9]{2,4}');
    table.columns().every(function(colIdx) {
        // Skip redcap generated cols
        if (Object.values(ReportTweaks.coreColumnMap).includes(colIdx)) {
            return;
        }
        $.each(this.data(), function(i, el) {
            el = el.split(' ')[0];
            if (el && isAnyDate.test(el))
                buildCache.push(colIdx);
            if (el) return false;
        });
    });

    // Rebuild the cache for sorting dates
    // Data Tables doesn't allow for chaning ordering/sorting functions after
    // init nor does it expose plugin tools to do so. We are forced to manually
    // rebuild the cache via un-documented means. We must do this after the draw.
    table.rows().every(function(rowIdx) {
        $.fn.dataTable.settings[0].aoData[rowIdx]._aSortData = [];
        let row = this.data();
        buildCache.forEach(function(colIdx) {
            let data = row[colIdx];
            data = data instanceof Object ? data.display : data;
            if (!data) {
                $.fn.dataTable.settings[0].aoData[rowIdx]._aSortData[colIdx] = 0;
                return;
            }
            let [date, time] = data.split(' ');
            date = isDate(date, "m-d-y") ? date_mdy2ymd(date) : date;
            $.fn.dataTable.settings[0].aoData[rowIdx]._aSortData[colIdx] =
                parseInt(date.replaceAll('-', '') + (time || "").replace(':', ''));
        });
    });
}

/*
Compares two arrays and if they can be merged without data loss 
then do so, otherwise return false.
*/
ReportTweaks.fn.mergeArray = function(arr1, arr2) {
    let target = [];
    $.each(arr1, function(index, arr1Value) {
        if (Object.values(ReportTweaks.coreColumnMap).includes(index)) {
            target[index] = null;
        } else if (arr2[index] == "" || arr1Value == "" || arr1Value == arr2[index]) {
            target[index] = arr1Value || arr2[index];
        } else {
            target = false;
            return true;
        }
    });
    return target;
}

/*
Remove rows from the table that contain no data except the record id
and redcap generated fields.
*/
ReportTweaks.fn.removeEmptyRows = function() {
    let table = $("#report_table").DataTable();
    let remove = [];
    table.rows().every(function(rowIdx, tableLoop, rowLoop) {
        let data = $.map(this.data(), (value, key) => typeof value == "string" ? value : value['display']);
        if (data.filter((datum, colIdx) =>
                !Object.values(ReportTweaks.coreColumnMap).includes(colIdx) && datum != "").length == 0) {
            remove.push(this.node());
        }
    });
    remove.forEach((row) => table.row(row).remove());
    table.draw();
}

/*
Toggle Column visibility for redcap_repeat_ columns.
*/
ReportTweaks.fn.toggleRepeatCols = function(show) {
    let table = $("#report_table").DataTable();
    table.column(ReportTweaks.coreColumnMap['redcap_repeat_instrument']).visible(show);
    table.column(ReportTweaks.coreColumnMap['redcap_repeat_instance']).visible(show);
    ReportTweaks.fn.updateTableWidth();
}

/*
Toggle Column visibility for event name column.
*/
ReportTweaks.fn.toggleEventCol = function(show) {
    let table = $("#report_table").DataTable();
    table.column(ReportTweaks.coreColumnMap['redcap_event_name']).visible(show);
    ReportTweaks.fn.updateTableWidth();
}

/*
CSS Tweaking function to resolve odd width behavior.
Ideally this would be resolved via CSS and this func removed.
*/
ReportTweaks.fn.updateTableWidth = function() {
    // Updates the width of the page Selector above the table OR the filter area when 1 page
    if ($(".report_pagenum_div").length) {
        $(".report_pagenum_div").css('width', $("#report_table").css('width'));
    } else {
        $("#report_table_filter").css('width', Number($("#report_table").css('width').replace('px', '')) - 30 + 'px');
    }
    ReportTweaks.fn.moveTableHeadersToggle();
}

/*
Gather and save current user settings to cookie
*/
ReportTweaks.fn.saveCookie = function() {
    let localCookie = {};
    $("#rtCheckboxes input").each((_, el) => { localCookie[$(el).attr('id')] = $(el).is(':checked') });
    ReportTweaks.cookie[ReportTweaks.em.getUrlParameter('report_id')] = localCookie;
    Cookies.set("RedcapReportTweaks", JSON.stringify(ReportTweaks.cookie), { sameSite: 'strict' });
}

/*
DOM Tweak for display of the "enable/disable" floating headers button
for consistancy. 
*/
ReportTweaks.fn.moveTableHeadersToggle = function() {

    // Wait for load
    if (!$("#FixedTableHdrsEnable").length) {
        window.requestAnimationFrame(ReportTweaks.fn.moveTableHeadersToggle);
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
ReportTweaks.fn.waitForLoad = function() {
    if ($("#report_table thead").length == 0) { // Still Loading
        window.requestAnimationFrame(ReportTweaks.fn.waitForLoad);
        return;
    }

    // Calculate locations (col #s) of redcap generated variables 
    ReportTweaks.coreColumnMap = {};
    $(`#report_table 
    th:contains(${ReportTweaks.record_id}),
    th:contains(redcap_repeat_instrument),
    th:contains(redcap_repeat_instance),
    th:contains(redcap_event_name)`).each(function(_, el) {
        ReportTweaks.coreColumnMap[$(el).find('.rpthdr').text()] = $(el).index();
    });

    // Build checkboxes
    ReportTweaks.fn.insertCopyBtn();
    ReportTweaks.fn.insertCheckboxes();
    ReportTweaks.fn.insertFilters();

    // Load Report Config
    let settings = ReportTweaks.settings[ReportTweaks.em.getUrlParameter('report_id')] || ReportTweaks.defaultSettings;
    if (settings.merge) {
        ReportTweaks.fn.mergeRows();
    }
    if (settings.removeEmpty) {
        ReportTweaks.fn.removeEmptyRows();
    }
    if (!settings.includeEvent) {
        ReportTweaks.fn.toggleEventCol(false);
        $("#hideEventCol").prop('disabled', true).prop('checked', false).parent().hide();
    }

    // Load Write Back Button config 
    if (settings.writeback) {
        ReportTweaks.fn.insertWriteback();
    }

    // Load Cookie
    let cookie = JSON.parse(Cookies.get("RedcapReportTweaks") || '{}');
    let report = ReportTweaks.em.getUrlParameter('report_id');
    if (!cookie[report] && location.host == "ctri-redcap.dom.wisc.edu") { // Force custom defaults
        cookie[report] = { hideRepeatCols: true, hideEventCol: true };
    }
    ReportTweaks.cookie = cookie;
    $.each(cookie[report], (key, value) => { if (value) $(`#${key}:enabled`).click() });

    // Setup Cookie Saving
    $("#rtCheckboxes input").on('click', ReportTweaks.fn.saveCookie);
}

/*
 Load the templates and our load func
 */
$(document).ready(function() {
    ReportTweaks.html = {};
    $.each($("template").prop('content').children, (_, el) =>
        ReportTweaks.html[$(el).prop('id')] = $(el).prop('outerHTML'));
    ReportTweaks.fn.waitForLoad();
});

/*
Watch for state history change (used on multi-page reports)
We can't avoid polling due to page changing using history push state
*/
let oldHref = document.location.href;
window.onload = function() {
    let bodyList = document.querySelector("body");
    let observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (oldHref != document.location.href) {
                oldHref = document.location.href;
                ReportTweaks.fn.waitForLoad();
            }
        });
    });
    observer.observe(bodyList, {
        childList: true,
        subtree: true
    });
};