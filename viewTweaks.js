ReportTweaks.fn = {};
ReportTweaks.html = {};
ReportTweaks.DateRegex = /^\d{2}\-\d{2}\-\d{4}$/ ;
ReportTweaks.html.copyBtn = `<a href="#" class="btn btn-secondary btn-sm mb-1" role="button" id="copyDataBtn"><i class="fas fa-clipboard"></i></a>`;
ReportTweaks.html.checkboxes = `
<div class="container p-0 mt-1" style="max-width:420px" id="checkboxGrouper">
    <div class="row no-gutters">
        <div class="col-md-5">
            <span class="font-weight-bold">Hide Event Column: </span>
            <input type='checkbox' class='checkbox-inline' id='hideEventCol'>
        </div>
        <div class="col-md-7">
            <span class="font-weight-bold">Hide Repeating Form Columns: </span>
            <input type='checkbox' class='checkbox-inline' id='hideRepeatCols'>
        </div>
        <div class="col-md-5" style="display:none">
            <span class="font-weight-bold">Option Three: </span>
            <input type='checkbox' class='checkbox-inline' id='OptionThree'>
        </div>
        <div class="col-md-7" style="display:none">
            <span class="font-weight-bold">Option Four: </span>
            <input type='checkbox' class='checkbox-inline' id='OptionFour'>
        </div>
    </div>
</div>`;
ReportTweaks.html.filters = `
    <span class="dataTables_filter">
        <label><input type="text" placeholder="Maximum" id="tableFilterMax" tabindex=3></label>
    </span>
    <span class="dataTables_filter">
        <label><input type="text" placeholder="Minimum" id="tableFilterMin" tabindex=2></label>
    </span>
    <span class="dataTables_filter">
        <select id="minmaxpivot">
            <option value="" selected disabled hidden>Filter Range On...</option>
        </select>
    </span>`;
ReportTweaks.html.wbBtn = `
<div style='margin-top:10px;'>
    <button class="tweaks_writeback report_btn jqbuttonmed ui-button ui-corner-all ui-widget" style="font-size:12px;">
        <i class="fas fa-pencil-alt fs10"></i> BtnLabel
    </button>
</div>`;
ReportTweaks.html.modalInput = `
<div class="form-group mb-0">
    <label class='font-weight-bold float-left mt-4'>LABEL</label>
    <input type="text" class="swal2-input mt-0 mb-0" id="ID">
</div>`;
ReportTweaks.css = `
<style>
    #copyDataBtn{
        color: #aaa;
        background-color: #eee;
        border-color: #eee;
    }
    #reportCopyAlert{
        width: 771px;
        border-color:#ffeeba!important;
    }
    #report_table{
        min-width: 900px;
    }
</style>`;

Date.prototype.addDays = function(days) {
    let date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

ReportTweaks.fn.insertCopyBtn = function() {
    if ( $(".report_pagenum_div").length ) { // Pagination
        $(".report_pagenum_div").first().before(ReportTweaks.html.copyBtn);
    } else { // One Page
        $("#report_table_wrapper").prepend(ReportTweaks.html.copyBtn);
        $("#copyDataBtn").css('float', 'left');
    }
    $("#copyDataBtn").popover({
        content: "Copy data below to clipboard",
        trigger: "hover"
    });
    $("#copyDataBtn").on("click",ReportTweaks.fn.copyData);
}

ReportTweaks.fn.insertCheckboxes = function() {
    $("#report_div .d-print-none").eq(1).append(ReportTweaks.html.checkboxes);
    if ( !Number.isInteger(ReportTweaks.coreColumnMap['redcap_repeat_instrument']) ) {
        $("#hideRepeatCols").prop('disabled',true).prop('checked',false).parent().hide();
    }
    if ( !Number.isInteger(ReportTweaks.coreColumnMap['redcap_event_name']) ) {
        $("#hideEventCol").prop('disabled',true).prop('checked',false).parent().hide();
    }
    $("#hideRepeatCols").on('click', function() {
        if ( $(this).is(':checked') )
            ReportTweaks.fn.hideRepeatCols();
        else 
            ReportTweaks.fn.showRepeatCols();
    });
    $("#hideEventCol").on('click', function() {
        if ( $(this).is(':checked') )
            ReportTweaks.fn.hideEventCol();
        else 
            ReportTweaks.fn.showEventCol();
    });
}

ReportTweaks.fn.insertFilters = function() {
    $(".dataTables-rc-searchfilter-parent").css('width','100%');
    $(".dataTables-rc-searchfilter-parent .col-sm-6").first().remove();
    $(".dataTables-rc-searchfilter-parent .col-sm-6").removeClass('col-sm-6').addClass('col-12 mt-1');
    $("#report_table_filter input").css('margin-right','3px');
    $("#report_table_filter").prepend(ReportTweaks.html.filters);
    $.fn.dataTable.ext.search.push(ReportTweaks.fn.rangeSearch);
}

ReportTweaks.fn.insertWriteback = function() {
    $("#report_div .d-print-none").last().append(
        ReportTweaks.html.wbBtn.replace('BtnLabel',
            ReportTweaks.settings[getParameterByName('report_id')]['_wb'].modalBtn));
    $(".tweaks_writeback").on("click", ReportTweaks.fn.openModal);
}

ReportTweaks.fn.packageData = function() {
    let writeArray = [];
    let table = $("#report_table").DataTable();
    let settings = ReportTweaks.settings[getParameterByName('report_id')]['_wb'];
    let counter = 0;
    
    table.rows().every( function(rowIdx) {
        let data = this.data();
        let writeValue = settings['writeStatic'];
        let type = settings['writeType'];
        
        if ( type == "today" )
            writeValue = today;
        if ( type == "ask" )
            writeValue = $("#"+settings['field']).val() || $("#"+settings['field']).prop('placeholder'); // Todo not sure how this works yet
        if ( settings['increment'] ) {
            if ( type == "today" ) {
                writeValue = (new Date(writeValue)).addDays(counter).toISOString().split('T')[0];
            } else {
                writeValue = (Number(writeValue) + counter).toString();
            }
            counter++;
        }
        
        writeArray.push({
            'record': $(data[ReportTweaks.coreColumnMap[ReportTweaks.record_id]])[0].text,
            'event': settings.event || data[ReportTweaks.coreColumnMap['redcap_event_name']], // Can be event id or display name
            'instrument': data[ReportTweaks.coreColumnMap['redcap_repeat_instrument']], // TODO go from name to instrument name
            'instance': data[ReportTweaks.coreColumnMap['redcap_repeat_instance']],
            'val': writeValue,
        });
    });
    
    return writeArray;
}

ReportTweaks.fn.toTitleCase = function(str) {
    return str.replace(/[_-]/g,' ').replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
}

ReportTweaks.fn.openModal = function() {
    let settings = ReportTweaks.settings[getParameterByName('report_id')]['_wb'];
    if ( !$("#report_table").DataTable().rows().count() ) {
        Swal.fire({
            icon: 'info',
            iconHtml: "<i class='fas fa-database'></i>",
            title: "No Records",
            html: "Nothin' to do boss" ,
        });
        return;
    }
    if ( !ReportTweaks.coreColumnMap[ReportTweaks.record_id] ) {
        Swal.fire({
            icon: 'info',
            iconHtml: "<i class='fas fa-database'></i>",
            title: "No Record ID",
            html: `You must include ${ReportTweaks.record_id} on your report to write back to the database.`,
        });
        return;
    }
    if ( ReportTweaks.writeDone ) {
        Swal.fire({
            icon: 'info',
            iconHtml: "<i class='fas fa-database'></i>",
            title: "Already Written",
            html: "You've already written once to the database. \
                   Please refresh the page before writing again." ,
        });
        return;
    }

    let html = settings.modalText;
    if ( settings.writeType == 'ask' ) {
        html += ReportTweaks.html.modalInput
            .replace('LABEL',ReportTweaks.fn.toTitleCase(settings.field))
            .replace('ID',settings.field)+'&nbsp;';
    }
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
    }).then( (result) => {
        if ( !result.value )
            return;
        $.ajax({
            method: 'POST',
            url: ReportTweaks.router,
            data: {
                route: 'reportWrite',
                field: settings.field,
                overwrite: !!settings.overwrites,
                ignoreInstance: settings.event == "",
                writeArray: JSON.stringify(ReportTweaks.fn.packageData())
            },
            error: (jqXHR, textStatus, errorThrown) => { 
                console.log(jqXHR);
                console.log(textStatus);
                console.log(errorThrown);
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'There was an issue writing back to the database.\
                         If possible, leave this window open and contact a RedCap Administrator',
                });
            },
            success: (data) => { 
                console.log(data);
                ReportTweaks.writeDone = true;
                Swal.fire({
                  icon: 'success',
                  title: 'Write Back Complete',
                  text: 'All data was successfully written back to the database',
                });
            }
        });
    })
}

ReportTweaks.fn.rangeSearch = function( settings, data, dataIndex ) {
    let min = $('#tableFilterMin').val();
    let max = $('#tableFilterMax').val();
    let target = $('#minmaxpivot').val() || "";
    let pivot = data[$("#report_table th").index($(`th:contains(${target})`))] || 0;
    
    min = isNumeric(min) ? Number(min) : ReportTweaks.DateRegex.test(min) ? date_mdy2ymd(min.replaceAll('/','-')) : min;
    max = isNumeric(max) ? Number(max) : ReportTweaks.DateRegex.test(max) ? date_mdy2ymd(max.replaceAll('/','-')) : max;
    pivot = isNumeric(pivot) ? Number(pivot) : ReportTweaks.DateRegex.test(pivot) ? date_mdy2ymd(pivot.replaceAll('/','-')) : pivot;
    
    if ( ( min==="" && max==="" ) ||
         ( target==="" ) ||
         ( min==="" && pivot <= max ) ||
         ( min <= pivot && max==="" ) ||
         ( min <= pivot && pivot <= max ) )
        return true;
    return false;
}

ReportTweaks.fn.copyData = function() {
    let headers = $("#report_table th:visible :last-child").filter('div').map(function() {
        return $(this).text();
    });
    let data = $("#report_table td:visible").map(function(index,value) {
        if ( index % headers.length == 0 )
            return '\n'+$(value).text();
        return $(value).text();
    });
    navigator.clipboard.writeText(headers.get().join('\t')+data.get().join('\t'));
}

ReportTweaks.fn.mergeRows = function() {
    let recordCol = $(`#report_table th:contains(${ReportTweaks.record_id})`);
    if( !recordCol.length )
        return;
    if ( $(recordCol).index() != 0 && !$(recordCol).hasClass('sorting_asc') ) 
        $(recordCol).click();
    recordCol = $(recordCol).index();
    let prev = -1;
    let table = $("#report_table").DataTable();
    let remove = [];
    table.rows().every(function(rowIdx, tableLoop, rowLoop){
        let row = this.data();
        let id = $(row[0]).text().split(' ')[0].trim();
        if (id != prev ) { prev = id; return;} 
        prev = id;
        let currData = $.map(row, (value,key) => {return typeof value == "string" ? value : value['display']});
        let prevData = $.map(table.row(rowIdx-1).data(), (value,key) => {return typeof value == "string" ? value : value['display']});
        let newData = ReportTweaks.fn.mergeArray(currData,prevData);
        if ( !newData )
            return;
        $(this.node()).find("td").each( function(index,el) {
            if ( newData[index] == null )
                return;
            if ( $(el).html() != newData[index] )
                table.cell(rowIdx, index).data( newData[index] );
            $(el).removeClass('nodesig');
        });
        remove.push(table.row(rowIdx-1).node());
    });
    remove.forEach((row)=>table.row(row).remove());
    table.draw();
}

ReportTweaks.fn.mergeArray = function(arr1, arr2) {
    let target = [];
    $.each( arr1, function(index,arr1Value) {
        if ( Object.values(ReportTweaks.coreColumnMap).includes(index) )
            target[index] = null;
        else if ( arr2[index] == "" || arr1Value == "" || arr1Value == arr2[index] )
            target[index] = arr1Value || arr2[index];
        else {
            target = false;
            return true;
        }
    });
    return target;
}

ReportTweaks.fn.removeEmptyRows = function() {
    let table = $("#report_table").DataTable();
    let remove = [];
    table.rows().every(function(rowIdx, tableLoop, rowLoop){
        if ( this.data().filter((datum, colIdx) => 
            !Object.values(ReportTweaks.coreColumnMap).includes(colIdx) && datum != "").length == 0 ){
            remove.push(this.node());
        }
    });
    remove.forEach((row)=>table.row(row).remove());
    table.draw();
}

ReportTweaks.fn.hideRepeatCols = function( show = false ) {
    let table = $("#report_table").DataTable();
    table.column(ReportTweaks.coreColumnMap['redcap_repeat_instrument']).visible(show);
    table.column(ReportTweaks.coreColumnMap['redcap_repeat_instance']).visible(show);
    ReportTweaks.fn.updateTableWidth();
}

ReportTweaks.fn.showRepeatCols = function() {
    ReportTweaks.fn.hideRepeatCols( true );
}

ReportTweaks.fn.hideEventCol = function( show = false) {
    let table = $("#report_table").DataTable();
    table.column(ReportTweaks.coreColumnMap['redcap_event_name']).visible(show);
    ReportTweaks.fn.updateTableWidth();
}

ReportTweaks.fn.showEventCol = function() {
    ReportTweaks.fn.hideEventCol( true );
}

ReportTweaks.fn.updateTableWidth = function() {
    // Updates the width of the page Selector above the table OR the filter area when 1 page
    if ( $(".report_pagenum_div").length )
        $(".report_pagenum_div").css('width', $("#report_table").css('width') );
    else
        $("#report_table_filter").css('width', Number($("#report_table").css('width').replace('px',''))-30+'px' );
    ReportTweaks.fn.moveTableHeadersToggle();
}

ReportTweaks.fn.saveCookie = function() {
    let saveCookie = {};
    $("#checkboxGrouper input").each( (_,el) => {saveCookie[$(el).attr('id')] = $(el).is(':checked')} );
    Cookies.set(`ReportTweaks${getParameterByName('report_id')}`,JSON.stringify(saveCookie),{sameSite: 'lax'});
}

ReportTweaks.fn.moveTableHeadersToggle = function() {
    // Wait for load
    if ( !$("#FixedTableHdrsEnable").length ) {
        window.requestAnimationFrame(ReportTweaks.fn.moveTableHeadersToggle);
        return;
    }
    // Link hasn't been moved
    if ( !$("#FixedTableHdrsEnable").hasClass('ReportTweaksAdjusted') ) {
        // Multi page report or Single Page tweak
        if ( $(".report_pagenum_div").length ) {
            $("#FixedTableHdrsEnable").insertAfter('#copyDataBtn').addClass('ReportTweaksAdjusted');
        } else {
            $("#FixedTableHdrsEnable").prependTo('#report_table_filter').addClass('ReportTweaksAdjusted');
        }
    }
    // Multi page report tweak for sizing
    if ( $(".report_pagenum_div").length )
        $("#FixedTableHdrsEnable").css('margin-left', Number($(".report_pagenum_div").css('width').replace('px',''))-170+'px' );
}

ReportTweaks.fn.waitForLoad = function() {
    if ( $("#report_table_wrapper").length != 1 ||      // Table Still Loading
         $("#report_div .d-print-none").length < 2 ) {  // Extra check
        window.requestAnimationFrame(ReportTweaks.fn.waitForLoad);
        return;
    }
    
    // Calculate locations (col #s) of redcap generated variables 
    ReportTweaks.coreColumnMap = {};
    $(`#report_table 
    th:contains(${ReportTweaks.record_id}),
    th:contains(redcap_repeat_instrument),
    th:contains(redcap_repeat_instance),
    th:contains(redcap_event_name)`.replaceAll('\n','')).each(function(_,el) {
        ReportTweaks.coreColumnMap[$(el).find('.rpthdr').text()] = $(el).index();
    });
    
    // Build checkboxes
    ReportTweaks.fn.insertCopyBtn();
    ReportTweaks.fn.insertCheckboxes();
    ReportTweaks.fn.insertFilters();
    
    // Load Report Config
    let settings = ReportTweaks.settings[getParameterByName('report_id')] || ReportTweaks.defaultSettings;
    if ( settings.merge ) {
        ReportTweaks.fn.mergeRows();
    }
    if ( settings.removeEmpty ) {
        ReportTweaks.fn.removeEmptyRows();
    }
    if ( !settings.includeEvent ) {
        ReportTweaks.fn.hideEventCol();
        $("#hideEventCol").prop('disabled',true).prop('checked',false).parent().hide();
    }
    
    // Load Write Back Button config 
    if ( settings.writeback ) {
        ReportTweaks.fn.insertWriteback();
    }
    
    // Load Cookie
    let cookie = JSON.parse(Cookies.get(`ReportTweaks${getParameterByName('report_id')}`) || '{}');
    if ($.isEmptyObject(cookie) && location.host == "ctri-redcap.dom.wisc.edu") { // Force custom defaults
        cookie = { hideRepeatCols:true, hideEventCol:true };
    } 
    $.each(cookie, (key,value) => {if(value) $(`#${key}:enabled`).click()} );
    
    // Setup Cookie Saving
    $("#checkboxGrouper input").on('click', ReportTweaks.fn.saveCookie);
}

$(document).ready(function () {
    $('head').append(ReportTweaks.css);
    ReportTweaks.fn.waitForLoad();
});

// You can't avoid polling due to page changing using history push state
var oldHref = document.location.href;
window.onload = function() {
    var bodyList = document.querySelector("body");
    var observer = new MutationObserver(function(mutations) {
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