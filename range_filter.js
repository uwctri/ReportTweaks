CTRItweaks.DateRegex = /^\d{2}\-\d{2}\-\d{4}$/ ;
$.fn.dataTable.ext.search.push(
    function( settings, data, dataIndex ) {
        var min = $('#tableFilterMin').val();
        var max = $('#tableFilterMax').val();
        var target = $('#minmaxpivot').val() || "";
        var pivot = data[$("#report_table th").index($(`th:contains(${target})`))] || 0;
        min = isNumeric(min) ? Number(min) : CTRItweaks.DateRegex.test(min) ? date_mdy2ymd(min.replaceAll('/','-')) : min;
        max = isNumeric(max) ? Number(max) : CTRItweaks.DateRegex.test(max) ? date_mdy2ymd(max.replaceAll('/','-')) : max;
        pivot = isNumeric(pivot) ? Number(pivot) : CTRItweaks.DateRegex.test(pivot) ? date_mdy2ymd(pivot.replaceAll('/','-')) : pivot;
        if ( ( min==="" && max==="" ) ||
             ( target==="" ) ||
             ( min==="" && pivot <= max ) ||
             ( min <= pivot && max==="" ) ||
             ( min <= pivot && pivot <= max ) )
            return true;
        return false;
    }
);

function placeInputBoxes() {
    if ( $("#report_table_wrapper").length == 1 ) {
        if ( $(".report_pagenum_div").length ) // We break on pagination
            return;
        $("#report_table_filter").prepend($("#FixedTableHdrsEnable"));
        var newFilters = `
        <div id="NewFiltersGroup">  
            <div class="dataTables_filter">
                <label><input type="text" placeholder="Maximum" id="tableFilterMax" tabindex=3></label>
            </div>
            <div class="dataTables_filter">
                <label><input type="text" placeholder="Minimum" id="tableFilterMin" tabindex=2></label>
            </div>
            <div class="dataTables_filter">
                <select id="minmaxpivot">
                    <option value="" selected disabled hidden>Filter Range On...</option>
                </select>
            </div>
        </div>`;
        $("#report_table_filter").before(newFilters);
        $("#report_table th :last-child").filter('div').each( function(){
            $("#minmaxpivot").append(`<option>${$(this).text()}</option>`)
        });
        $('#tableFilterMin, #tableFilterMax').keyup( function() {
            $("#report_table").DataTable().draw();
        });
        $('#minmaxpivot').on("change", function() {
            $("#report_table").DataTable().draw();
        });
        $("#report_table_filter input").attr("tabindex",1)
        monitorBoxes();
    }
    else {
        if ($('#report_load_progress2').is(":visible") || $('#report_load_progress').is(":visible"))
            setTimeout(placeInputBoxes,1000)
        else
            window.requestAnimationFrame(placeInputBoxes);
    }
}

$(document).ready(function () {
    $('head').append(
    `<style>
        #report_parent_div{
            padding-right: 15px;
        }
        #report_table{
            min-width: 100%;
        }
        #report_div{
            margin-right: 10px !important;  
        }
        #NewFiltersGroup{
            display: contents;
        }
        #minmaxpivot{
            margin-left: 6px;
            height: 24px;
        }
    </style>`);
    placeInputBoxes();
});