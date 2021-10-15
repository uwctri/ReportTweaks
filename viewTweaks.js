ReportTweaks.fn = {};
ReportTweaks.html = {};
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

ReportTweaks.fn.reStripeRows = function() {
    $("tr.odd:visible,tr.even:visible").each( function(i){
        $(this).removeClass();
        if (i%2 == 0) $(this).addClass('even');
        else $(this).addClass('odd');
    });
}

ReportTweaks.fn.mergeRows = function() {
    let recordCol = $(`#report_table th:contains(${ReportTweaks.record_id})`);
    if( !recordCol.length )
        return;
    if ( $(recordCol).index() != 0 && !$(recordCol).hasClass('sorting_asc') ) 
        $(recordCol).click();
    recordCol = $(recordCol).index();
    let prev = -1;
    $("#report_table tr").each(function(index,row){
        if ( index == 0)// Header
            return;
        let id = $(row).find('td a').eq(recordCol).text();
        if (id != prev ) {
            prev = id;
            return;           // TODO Test, Make sure this works when Redcap_ variables are visible
        }
        let currData = $(row).find(`td:visible:not(:eq(${recordCol}))`).map((_,x)=>$(x).text()).toArray();
        let prevData = $(row).prevAll(':visible').first().find(`td:visible:not(:eq(${recordCol}))`).map((_,x)=>$(x).text()).toArray();
        let newData = ReportTweaks.fn.mergeArray(currData,prevData);
        if ( newData ) {
            $(row).find(`td:visible:not(:eq(${recordCol}))`).each( function(index,el) {
                if ( $(el).text() != newData[index] ) {
                    $(el).removeClass('nodesig').text(newData[index]);
                    $(el).addClass('squashedPopCell');
                }
            });
            $(row).prevAll(':visible').first().addClass('squashRowHide').hide();
        }
        prev = id;
    });
}

ReportTweaks.fn.mergeArray = function(arr1, arr2) {
    let target = [];
    $.each( arr1, function(index,arr1Value) {
        if ( arr2[index] == "" || arr1Value == "" )
            target[index] = arr1Value || arr2[index];
        else {
            target = false;
            return true;
        }
    });
    return target;
}

ReportTweaks.fn.removeEmptyRows = function() {
    let skip = $(`#report_table th:contains(${ReportTweaks.record_id}),th:contains(redcap_repeat_instrument),th:contains(redcap_repeat_instance),th:contains(redcap_event_name)`).map( (_,el) => $(el).index()).toArray();
    let header = $("#report_table thead tr").length;
    $('#report_table tr').slice(header).filter(function(){
        return $(this).find('td').filter(function(i) {
            if ( !skip.includes(i) && $(this).text()!='') {
                return true;
            }
        }).length == 0;
    }).remove();
}

ReportTweaks.fn.hideRepeatCols = function() {
    let haystack = ["redcap_repeat_instrument","redcap_repeat_instance"];
    $('#report_table th :first-child').not("wbr").each( function(i) {
        if ( haystack.includes($(this).text()) ) {
            $(this).parent().addClass('repeatCol').hide();
            $(`#report_table td:nth-child(${i+1})`).addClass('repeatCol').hide();
        }
    });
    ReportTweaks.fn.updateTableWidth();
}

ReportTweaks.fn.showRepeatCols = function() {
    $("#report_table th.repeatCol, #report_table td.repeatCol").show();
    ReportTweaks.fn.updateTableWidth();
}

ReportTweaks.fn.hideEventCol = function(remove) {
    $('#report_table th :first-child').not("wbr").each( function(i) {
        if ( $(this).text() == "redcap_event_name" ) {
            $(this).parent().addClass('eventCol').hide();
            if ( remove )
                (`#report_table td:nth-child(${i+1})`).remove();
            else
                $(`#report_table td:nth-child(${i+1})`).addClass('eventCol').hide();
        }
    });
    ReportTweaks.fn.updateTableWidth();
}

ReportTweaks.fn.showEventCol = function() {
    $("#report_table th.eventCol, #report_table td.eventCol").show();
    ReportTweaks.fn.updateTableWidth();
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
        $("#FixedTableHdrsEnable").css('margin-left', Number($("#report_table").css('width').replace('px',''))-200+'px' );
}

ReportTweaks.fn.waitForLoad = function() {
    if ( $("#report_table_wrapper").length != 1 ||      // Table Still Loading
         $("#report_div .d-print-none").length < 2 ) {  // Extra check
        window.requestAnimationFrame(ReportTweaks.fn.waitForLoad);
        return;
    }
    // Build checkboxes
    ReportTweaks.fn.insertCopyBtn();
    ReportTweaks.fn.insertCheckboxes();
    ReportTweaks.fn.insertFilters();
    
    // Load Report Config
    let settings = ReportTweaks.settings[getParameterByName('report_id')];
    if ( settings ) {
        if ( settings.merge ) {
            ReportTweaks.fn.mergeRows();
        }
        if ( settings.removeEmpty ) {
            ReportTweaks.fn.removeEmptyRows();
        }
        if ( settings.removeEvent ) {
            ReportTweaks.fn.hideEventCol(true);
            $("#hideEventCol").prop('disabled',true).prop('checked',false);
        }
    }
    
    // Load Cookie
    let cookie = JSON.parse(Cookies.get(`ReportTweaks${getParameterByName('report_id')}`) || '{}');
    if ($.isEmptyObject(cookie) && location.host == "ctri-redcap.dom.wisc.edu") { // Force custom defaults
        cookie = { hideEventCol: true, hideRepeatCols:true };
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