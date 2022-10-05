ReportTweaks.fn = {};
ReportTweaks.cookie = {};
ReportTweaks.isMdyDate = RegExp('[0-9]{2}-[0-9]{2}-[0-9]{4}');

/*
Utility function to add days to a date
*/
Date.prototype.addDays = function (days) {
    let date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

/*
Manipulate DOM to insert the Copy Button regardless
of report format.
*/
ReportTweaks.fn.insertCopyBtn = () => {
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
Event and Redcap repeat vars and date range filter. Hides
either after insert if they are not able to be used.
*/
ReportTweaks.fn.insertToggleFilters = () => {

    // Insert into the DOM
    $("#report_div .d-print-none").eq(1).append(ReportTweaks.html.rtCheckboxes);

    // Hide some checkboxes if needed
    let keys = Object.keys(ReportTweaks.headers.core);
    if (!keys.includes('redcap_repeat_instrument')) {
        $("#hideRepeatCols").prop('disabled', true).prop('checked', false).parent().hide();
    }
    if (!keys.includes('redcap_event_name')) {
        $("#hideEventCol").prop('disabled', true).prop('checked', false).parent().hide();
    }

    // Hide the date range filter if needed
    let field = ReportTweaks.settings.dateField;
    let enable = ReportTweaks.settings.dateRange;
    if (!enable || !field || !Object.keys(ReportTweaks.headers.all).includes(field)) {
        $("#filterDateRange").parent().hide();
    }

    // Add events to toggle col visibility
    let fn = ReportTweaks.fn;
    $("#hideRepeatCols").on('click', (el) => fn.toggleRepeatCols(!el.currentTarget.checked));
    $("#hideEventCol").on('click', (el) => fn.toggleEventCol(!el.currentTarget.checked));

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
ReportTweaks.fn.insertFilters = () => {

    // HTML Setup
    $(".dataTables-rc-searchfilter-parent").css('width', '100%');
    $(".dataTables-rc-searchfilter-parent .col-sm-6").first().remove();
    $(".dataTables-rc-searchfilter-parent .col-sm-6").removeClass('col-sm-6').addClass('col-12 mt-1');
    $("#report_table_filter input").css('margin-right', '3px');
    $("#report_table_filter").prepend(ReportTweaks.html.rtFilters);

    // Populate the pivot drop down
    let dropdown = $('#minmaxpivot');
    Object.keys(ReportTweaks.headers.all).forEach((el) => dropdown.append(new Option(el, el)));

    // Add the search function
    $.fn.dataTable.ext.search.push(ReportTweaks.fn.rangeSearch);

    // Perform the search when any of the new feilds are used
    let table = $("#report_table").DataTable();
    $('#minmaxpivot, #tableFilterMin, #tableFilterMax').keyup(table.draw);
}

/*
Inserts buttons below the live filters or write back buttons if they
are configured.
*/
ReportTweaks.fn.insertWriteback = () => {
    $("#report_div .d-print-none").eq(1).append(
        ReportTweaks.html.rtModalBtn.replace('BtnLabel',
            ReportTweaks.fn.htmlDecode(ReportTweaks.settings['_wb'].modalBtn)));
    $(".tweaks_writeback").on("click", ReportTweaks.fn.openModal);
}

/*
Gathers data for every row in preperation for a write back.
Finds event and repeating instrument/instance if it exists.
Also handles write value calculation, if any.
*/
ReportTweaks.fn.packageData = () => {
    let writeArray = [];
    let table = $("#report_table").DataTable();
    let settings = ReportTweaks.settings['_wb'];
    let counter = 0;
    let counterDay = new Date(today);
    let writeValue = settings.writeStatic;
    let type = settings.writeType;

    if (type == "today") {
        writeValue = today;
    } else if (type == "ask") {
        writeValue = $(`#${settings.field}`).val();
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
        const record = $(data[ReportTweaks.headers.core['record_id']])[0].text;
        let eventid = data[ReportTweaks.headers.core['redcap_event_name']] || "";
        let instrument = data[ReportTweaks.headers.core['redcap_repeat_instrument']] || "";
        let instance = data[ReportTweaks.headers.core['redcap_repeat_instance']] || "";
        if (settings.event) {
            eventid = settings.event;
            instrument = "";
            instance = "";
        }
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
ReportTweaks.fn.toTitleCase = (str) => {
    return str.replace(/[_-]/g, ' ').replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
}

/*
Safe decode for HTML strings sent from PHP
*/
ReportTweaks.fn.htmlDecode = (input) => {
    var doc = new DOMParser().parseFromString(input, "text/html");
    return doc.documentElement.textContent;
}

/*
Checks report, configuration, and if valid then generates/displays
the write back modal to user. 
*/
ReportTweaks.fn.openModal = () => {
    let settings = ReportTweaks.settings['_wb'];
    let defaults = { icon: 'info', iconHtml: "<i class='fas fa-database'></i>" }

    // No records exist on the report
    if (!$.fn.DataTable.isDataTable('#report_table') ||
        !$("#report_table").DataTable().rows().count()) {
        Swal.fire({
            ...defaults,
            title: ReportTweaks.em.tt("modal_view_1"),
            html: ReportTweaks.em.tt("modal_view_2"),
        });
        return;
    }

    // Record ID is missing from the report
    if (!isNumeric(ReportTweaks.headers.core['record_id'])) {
        Swal.fire({
            ...defaults,
            title: ReportTweaks.em.tt("modal_view_3"),
            html: ReportTweaks.em.tt("modal_view_4").replace('_', ReportTweaks.record_id),
        });
        return;
    }

    // Bad configuration
    if (!settings.field) {
        Swal.fire({
            ...defaults,
            title: ReportTweaks.em.tt("modal_view_5"),
            html: ReportTweaks.em.tt("modal_view_6"),
        });
        return;
    }

    // Write back has occured once already
    if (ReportTweaks.writeDone) {
        Swal.fire({
            ...defaults,
            title: ReportTweaks.em.tt("modal_view_7"),
            html: ReportTweaks.em.tt("modal_view_8"),
        });
        return;
    }

    // Build out modal text if needed
    let html = ReportTweaks.fn.htmlDecode(settings.modalText);
    if (settings.writeType == 'ask') {
        html += ReportTweaks.html.rtModalInput
            .replace('LabelText', ReportTweaks.fn.toTitleCase(settings.field))
            .replace('newID', settings.field) + '&nbsp;';
    }

    // Display modal and handle response from server
    Swal.fire({
        icon: 'question',
        title: ReportTweaks.em.tt("modal_view_9"),
        html: html,
        footer: ReportTweaks.fn.htmlDecode(settings.footer),
        showCloseButton: true,
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#d33',
        confirmButtonText: ReportTweaks.em.tt("modal_view_10")
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
                writeArray: JSON.stringify(ReportTweaks.fn.packageData()),
                redcap_csrf_token: ReportTweaks.csrf
            },
            error: (jqXHR, textStatus, errorThrown) => {
                console.log(`${jqXHR}\n${textStatus}\n${errorThrown}`);
                Swal.fire({
                    icon: 'error',
                    title: ReportTweaks.em.tt("modal_view_11"),
                    text: ReportTweaks.em.tt("modal_view_12"),
                });
            },
            success: (data) => {
                // Expected Reuturn value format - 
                // {"errors":[],"warnings":[],"ids":{"5512":"5512"},"item_count":2} OR
                // {"warnings":["No data to write"]}
                console.log(data);
                data = JSON.parse(data);
                ReportTweaks.writeDone = true;
                if (data.warnings.length || data.errors.length) {
                    let warningText = data.warnings.concat(data.errors).join(', ');
                    Swal.fire({
                        icon: 'warning',
                        title: ReportTweaks.em.tt("modal_view_13"),
                        html: `${ReportTweaks.em.tt("modal_view_14")}<br>${ReportTweaks.em.tt("modal_view_15")}: ${warningText}`
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: ReportTweaks.em.tt("modal_view_16"),
                        text: ReportTweaks.em.tt("modal_view_17").replace('_', Object.keys(data.ids).length),
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
ReportTweaks.fn.rangeSearch = (settings, data, dataIndex) => {

    let min, max, field;
    let days = Number($("#filterDateRange").val());

    // Prioritize the drop down over the search
    if (ReportTweaks.settings.dateRange && days > 0) {
        min = (new Date(today)).addDays(-days).toISOString().split('T')[0];
        max = today;
        field = ReportTweaks.settings.dateField;
    } else {
        min = $('#tableFilterMin').val();
        max = $('#tableFilterMax').val();
        field = $('#minmaxpivot').val() || "";

        // Parse any non-ymd dates to ymd
        min = isNumeric(min) ? Number(min) : ReportTweaks.isMdyDate.test(min) ? date_mdy2ymd(min.replaceAll('/', '-')) : min;
        max = isNumeric(max) ? Number(max) : ReportTweaks.isMdyDate.test(max) ? date_mdy2ymd(max.replaceAll('/', '-')) : max;
    }

    // Gather the data for the row
    let datum = data[ReportTweaks.headers.all[field]?.index] || 0;
    datum = field == ReportTweaks.record_id ? datum.split(' ')[0] : datum;

    // Col data could be non-ymd
    datum = isNumeric(datum) ? Number(datum) : ReportTweaks.isMdyDate.test(datum) ? date_mdy2ymd(datum.replaceAll('/', '-')) : datum;

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
ReportTweaks.fn.copyData = () => {

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
Copy all visible data from the report including headers to the user's clipboard as a 
tab deliminted sheet that can be easily pasted into excel or other software.
*/
ReportTweaks.fn.mergeRows = () => {

    // Gather common values
    let table = $("#report_table").DataTable();
    const idIdx = ReportTweaks.headers.core.record_id;

    // Check if we have a record id column
    if (idIdx < 0) {
        // Can't merge without record id
        return;
    }

    // Build a mapping of colindex to validation AND
    // Build a cache of the indexs with a date validation for later
    let validationMap = {};
    let buildCache = []
    Object.entries(ReportTweaks.headers.all).forEach((el) => {
        let data = el[1];
        validationMap[data.index] = data.validation;
        if (["date_mdy", "date_dmy"].includes(data.validation)) {
            buildCache.push(data.index);
        }
    });

    // Get initial ordering
    let ordering = table.order();
    if (!ordering.length) {
        ordering = ReportTweaks.sort
            .filter(x => x.field)
            .map(x => [ReportTweaks.headers.all[x.field]?.index, x.sort.toLowerCase()])
            .filter(x => x[0] !== undefined);
    }

    // Re-sort the table if needed, we will restore at the end
    let sort = false;
    if (ordering[0][0] != idIdx || ordering.length > 1) {
        sort = true;
        table.order([idIdx, "asc"]).draw();
    }

    // Setup for loop
    let prev = {
        'id': -1,
        'index': -1
    };
    let remove = [];

    // Loop over all rows in the table
    table.rows().every(function (rowIdx, tableLoop, rowLoop) {

        // Gather basic stuff
        let row = this.data();
        let id = $(row[0]).text().split(' ')[0].trim();
        let tmpId = prev.id;

        // Check to see if this and prev row match, else bail 
        // We need to stash rowIdx here as datatables API always
        // returns the init row index, not the current displayed ordered
        if (id != tmpId) {
            prev = {
                'id': id,
                'index': rowIdx
            };
            return;
        }

        // Map all current and previous row data so we can compare display values
        // Merge the two and if successful continue 
        let currData = $.map(row, (value, key) => typeof value == "string" ? value : value['display']);
        let prevData = $.map(table.row(prev.index).data(), (value, key) => typeof value == "string" ? value : value['display']);
        let newData = ReportTweaks.fn.mergeArray(currData, prevData);
        if (!newData) {
            return;
        }

        // Populate the row with the merged data and remove
        // any bad styling. Skip spots where no new data exists
        $(this.node()).find("td").each(function (index, el) {
            if (newData[index] == null) {
                return;
            }
            $(el).removeClass('nodesig');
            if ($(el).html() != newData[index]) {
                table.cell(rowIdx, index).data(newData[index]);
            }
        });

        // Save the node to our remove list
        remove.push(table.row(prev.index).node());

        // Stash current id/row
        prev = {
            'id': id,
            'index': rowIdx
        };
    });

    // Review and trash rows that have been merged into others, update
    remove.forEach((row) => table.row(row).remove());
    $("#report_div span").first().text(table.rows().count()); // count
    table.draw();

    // Rebuild the cache for sorting dates
    // Data Tables doesn't allow for chaning ordering/sorting functions after
    // init nor does it expose plugin tools to do so. We are forced to manually
    // rebuild the cache via un-documented means. We must do this after the draw.
    table.rows().every(function (rowIdx) {
        $.fn.dataTable.settings[0].aoData[rowIdx]._aSortData = [];
        let row = this.data();
        buildCache.forEach(function (colIdx) {
            let data = row[colIdx];
            data = data instanceof Object ? data.display : data;
            if (!data) {
                $.fn.dataTable.settings[0].aoData[rowIdx]._aSortData[colIdx] = 0;
                return;
            }
            let [date, time] = data.split(' ');
            if (validationMap[colIdx] == "date_dmy") {
                date = date_dmy2ymd(date);
            } else if (validationMap[colIdx] == "date_mdy") {
                date = date_mdy2ymd(date);
            }
            $.fn.dataTable.settings[0].aoData[rowIdx]._aSortData[colIdx] =
                parseInt(date.replaceAll('-', '') + (time || "").replace(':', ''));
        });
    });

    // Restore init sorting scheme
    if (sort) {
        // Newer versions of DT throw an error when passing in the default -1
        ordering[0][0] = ordering[0][0] == -1 ? 0 : ordering[0][0];
        table.order(ordering).draw();
    }

}

/*
Compares two arrays and if they can be merged without data loss 
then do so, otherwise return false.
*/
ReportTweaks.fn.mergeArray = (arr1, arr2) => {
    let target = [];
    $.each(arr1, function (index, arr1Value) {
        if (Object.values(ReportTweaks.headers.core).includes(index)) {
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
ReportTweaks.fn.removeEmptyRows = () => {
    let table = $("#report_table").DataTable();
    let remove = [];
    table.rows().every(function (rowIdx, tableLoop, rowLoop) {
        let data = $.map(this.data(), (value, key) => typeof value == "string" ? value : value['display']);
        if (data.filter((datum, colIdx) =>
            !Object.values(ReportTweaks.headers.core).includes(colIdx) && datum != "").length == 0) {
            remove.push(this.node());
        }
    });
    remove.forEach((row) => table.row(row).remove());
    table.draw();
}

ReportTweaks.fn.adv_log = function () {
    //GET Advanced_logic var saved in php
    var adv_log = document.getElementById('adv_log_id').value
    
     //Create advanced logic
     let adv_log_div = document.createElement('div')
     adv_log_div.setAttribute('style','font-size:5px')
     var adv_log_html = "\
      <p><button class='btn btn-primary btn-xs' type='button' data-bs-toggle='collapse' data-bs-target='#collapseExample' aria-expanded='false' aria-controls='collapseExample'> \
     Show filter's advanced logic \
     </button></p> \
     </p> \
     <div class='collapse' id='collapseExample'> \
     <div class='card card-body p-1' style='width: 33%'> \
     <p><code>" + adv_log + "</code></p>\
     </div> \
     </div>"
     adv_log_div.innerHTML = adv_log_html
     document.getElementById("this_report_title").appendChild(adv_log_div)
    }
/*
Toggle Column visibility for redcap_repeat_columns.
*/
ReportTweaks.fn.toggleRepeatCols = (show) => {
    let table = $("#report_table").DataTable();
    let keys = Object.keys(ReportTweaks.headers.core);
    if (keys.includes('redcap_repeat_instrument')) {
        table.column(ReportTweaks.headers.core['redcap_repeat_instrument']).visible(show);
    }
    if (keys.includes('redcap_repeat_instance')) {
        table.column(ReportTweaks.headers.core['redcap_repeat_instance']).visible(show);
    }
    ReportTweaks.fn.updateTableWidth();
}

/*
Toggle Column visibility for event name column.
*/
ReportTweaks.fn.toggleEventCol = (show) => {
    if (!Object.keys(ReportTweaks.headers.core).includes('redcap_event_name')) {
        return;
    }
    let table = $("#report_table").DataTable();
    table.column(ReportTweaks.headers.core['redcap_event_name']).visible(show);
    ReportTweaks.fn.updateTableWidth();
}

/*
CSS Tweaking function to resolve odd width behavior.
Ideally this would be resolved via CSS and this func removed.
*/
ReportTweaks.fn.updateTableWidth = () => {
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
ReportTweaks.fn.saveCookie = () => {
    let localCookie = {};
    $("#rtCheckboxes input").each((_, el) => { localCookie[$(el).attr('id')] = $(el).is(':checked') });
    ReportTweaks.cookie[ReportTweaks.em.getUrlParameter('report_id')] = localCookie;
    Cookies.set("RedcapReportTweaks", JSON.stringify(ReportTweaks.cookie), { sameSite: 'strict' });
}

/*
DOM Tweak for display of the "enable/disable" floating headers button
for consistancy. 
*/
ReportTweaks.fn.moveTableHeadersToggle = () => {

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
ReportTweaks.fn.waitForLoad = () => {
    if ($("#report_table thead").length == 0 ||
        !$.fn.DataTable.isDataTable("#report_table")) { // Still Loading
        window.requestAnimationFrame(ReportTweaks.fn.waitForLoad);
        return;
    }

    if ($("#rtCopyDataBtn").length) { // Stop double loading on animation lag
        return;
    }

    // Filter out any null values
    ReportTweaks.headers.core = Object.fromEntries(Object.entries(ReportTweaks.headers.core).filter(pair => isInteger(pair[1])));

    // Build checkboxes
    ReportTweaks.fn.insertCopyBtn();
    ReportTweaks.fn.insertToggleFilters();
    ReportTweaks.fn.insertFilters();

    // Load Report Config
    if (ReportTweaks.settings.merge) {
        ReportTweaks.fn.mergeRows();
    }
    if (ReportTweaks.settings.removeEmpty) {
        ReportTweaks.fn.removeEmptyRows();
    }
    if (!ReportTweaks.settings.includeEvent) {
        ReportTweaks.fn.toggleEventCol(false);
        $("#hideEventCol").prop('disabled', true).prop('checked', false).parent().hide();
    }
    if (ReportTweaks.settings.adv_log) {
        ReportTweaks.fn.adv_log();
    }

    // Load Write Back Button config 
    if (ReportTweaks.settings.writeback) {
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
 Load the templates and start our load func
 */
$(document).ready(() => {
    ReportTweaks.html = {};
    $.each($("template[id=ReportTweaks]").prop('content').children, (_, el) =>
        ReportTweaks.html[$(el).prop('id')] = $(el).prop('outerHTML'));
    ReportTweaks.fn.waitForLoad();
});

/*
Watch for state history change (used on multi-page reports)
We can't avoid polling due to page changing using history push state
*/
let oldHref = document.location.href;
window.onload = () => {
    let bodyList = document.querySelector("body");
    let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
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