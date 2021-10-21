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
    let haystack = ["redcap_repeat_instrument","redcap_repeat_instance"];
    let colsExist = false;
    $("#report_table").DataTable().columns().every(function() {
        if ( haystack.includes( $(this.header()).find(':first-child').text() ) ) {
            colsExist = true;
            return false;
        }
    });
    if ( !colsExist ) {
        $("#hideRepeatCols").prop('disabled',true).prop('checked',false).parent().hide();
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
        if ( ReportTweaks.colIndexSkip.includes(index) )
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
            !ReportTweaks.colIndexSkip.includes(colIdx) && datum != "").length == 0 ){
            remove.push(this.node());
        }
    });
    remove.forEach((row)=>table.row(row).remove());
    table.draw();
}

ReportTweaks.fn.hideRepeatCols = function( show = false ) {
    let haystack = ["redcap_repeat_instrument","redcap_repeat_instance"];
    $("#report_table").DataTable().columns().every(function() {
        if ( haystack.includes( $(this.header()).find(':first-child').text() ) ) {
            this.visible(show);
        }
    });
    ReportTweaks.fn.updateTableWidth();
}

ReportTweaks.fn.showRepeatCols = function() {
    ReportTweaks.fn.hideRepeatCols( true );
}

ReportTweaks.fn.hideEventCol = function( show = false) {
    $("#report_table").DataTable().columns().every(function() {
        if ( $(this.header()).find(':first-child').text() == "redcap_event_name" ) {
            this.visible(show);
            return false;
        }
    });
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
    ReportTweaks.colIndexSkip = $(`#report_table 
    th:contains(${ReportTweaks.record_id}),
    th:contains(redcap_repeat_instrument),
    th:contains(redcap_repeat_instance),
    th:contains(redcap_event_name)`.replaceAll('\n','')).map( (_,el) => $(el).index()).toArray();
    
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
    
    // Load Cookie
    let cookie = JSON.parse(Cookies.get(`ReportTweaks${getParameterByName('report_id')}`) || '{}');
    if ($.isEmptyObject(cookie) && location.host == "ctri-redcap.dom.wisc.edu") { // Force custom defaults
        cookie = { hideRepeatCols:true, hideEventCol:true };
    } 
    $.each(cookie, (key,value) => {if(value) $(`#${key}`).click()} );
    
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