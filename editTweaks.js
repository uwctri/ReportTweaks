ReportTweaks.fn = {};
ReportTweaks.html = {};
ReportTweaks.modalSettings = {};
ReportTweaks.css = `
<style>
    .wbModal .row {
        margin-top: 10px;
    }
    .wbModal label {
        text-align: right;
    }
    .swal2-content {
        padding: 0;
    }
    #tweaks_config {
        cursor: pointer;
    }
</style>
`;
ReportTweaks.html.dashboard = `
<div style="margin:0 0 4px 20px;text-indent:-18px;">
    <input name="tweaks_includeEvent" type="checkbox"> Include <code>redcap_event_name</code> in the report.
</div>
<div style="margin:0 0 4px 20px;text-indent:-18px;">
    <input name="tweaks_merge" type="checkbox"> Attempt to combine rows representing the same record.
</div>
<div style="margin:0 0 4px 20px;text-indent:-18px;">
    <input name="tweaks_removeEmpty" type="checkbox"> Remove rows with no data (i.e. empty) other than <code>redcap_</code> variables and <code>record_id</code>.
</div>
<div style="margin:0 0 4px 20px;text-indent:-18px;">
    <input name="tweaks_writeback" type="checkbox"> Add a button to write data back to the database. Useful for removing records from a report or flagging records as reviewed. <br/> <span id="tweaks_config"><i class="fas fa-cog ml-3" style="color:grey"></i>Configure</span>
</div>`;
ReportTweaks.html.wbModal = `
<div class="container wbModal">
    <div class="row">
        <label class="col-sm-4 control-label" for="modalBtn">Button Text</label>  
        <div class="col-sm-8">
            <input id="modalBtn" name="modalBtn" type="text" placeholder="Mark as Complete" class="form-control input-md">
        </div>
    </div>
    <div class="row">
        <label class="col-sm-4 control-label" for="modalText">Popup Message</label>
        <div class="col-sm-8">                     
            <textarea class="form-control" id="modalText" name="modalText">Are you sure?</textarea>
        </div>
    </div>
    <div class="row">
        <label class="col-sm-4 control-label" for="footer">Footer Text</label>
        <div class="col-sm-8">
            <textarea class="form-control" id="footer" name="footer"></textarea>
        </div>
    </div>
    <div class="row">
        <label class="col-sm-4 control-label" for="event">Event</label>
        <div class="col-sm-8">
            <select id="event" name="event" class="form-control">
                <option value="">NA/Pull From Report</option>
            </select>
        </div>
    </div>
    <div class="row">
        <label class="col-sm-4 control-label" for="field">Field</label>
        <div class="col-sm-8">
            <select id="field" name="field" class="form-control">
            </select>
        </div>
    </div>
    <div class="row">
        <label class="col-md-4 control-label" for="writeType">Write Value</label>
        <div class="col-md-8 text-left">
            <div class="radio">
                <label for="writeType-ask">
                    <input type="radio" name="writeType" id="writeType-ask" value="ask" checked="checked">
                    Ask User for Write Value
                </label>
            </div>
            <div class="radio">
                <label for="writeType-static">
                    <input type="radio" name="writeType" id="writeType-static" value="static">
                    Static
                </label>
            </div>
            <div class="radio">
                <label for="writeType-today">
                    <input type="radio" name="writeType" id="writeType-today" value="today">
                    Today's Date
                </label>
            </div>
        </div>
    </div>
    <div class="row" id="writeStaticRow" style="display:none">
        <label class="col-sm-4 control-label" for="writeStatic">Write Value</label>  
        <div class="col-sm-8">
            <input id="writeStatic" name="writeStatic" type="text" placeholder="" class="form-control input-md">
        </div>
    </div>
    <div class="row">
        <div class="col-sm-2"></div>
        <div class="col-sm-10 text-left">
            <div class="checkbox">
                <label for="overwrites">
                    <input type="checkbox" name="overwrites" id="overwrites" value="1">
                    Allow Data Overwrites
                </label>
            </div>
            <div class="checkbox">
                <label for="increment">
                    <input type="checkbox" name="increment" id="increment" value="1">
                    Increment Write Value per Row
                </label>
            </div>
        </div>
    </div>
</div>`;

ReportTweaks.fn.loadSettings = function() {
    let settings = ReportTweaks.settings[getParameterByName('report_id')] || ReportTweaks.defaultSettings;
    $.each(settings, (key,val) => $(`input[name=tweaks_${key}]`).prop('checked', val) );
    ReportTweaks.modalSettings = settings['_wb'] || ReportTweaks.modalSettings;
}

ReportTweaks.fn.saveSettings = function() {
    let settings = {};
    $("input[name^=tweaks_]").each( (_,el) => {settings[$(el).attr('name').replace('tweaks_','')] = $(el).is(':checked')} );
    settings['_wb'] = ReportTweaks.modalSettings;
    $.ajax({
        method: 'POST',
        url: ReportTweaks.router,
        data: {
            route: 'saveConfig',
            report: getParameterByName('report_id'),
            settings: JSON.stringify(settings)
        },
        error: (jqXHR, textStatus, errorThrown) => console.log(`${jqXHR}\n${textStatus}\n${errorThrown}`),
        success: () => console.log("Report Tweaks Settings Saved")
    });
}

ReportTweaks.fn.openModal = function() {
    Swal.fire({
        title: 'DB Writeback Config',
        html: ReportTweaks.html.wbModal
    }).then( () => {
        // Save settings on close, not written to DB
        ReportTweaks.modalSettings = {};
        $(".wbModal").find('input, select, textarea').each( function() {
            if ( this.type == "checkbox" ) {
                ReportTweaks.modalSettings[this.name] = this.checked;
            } else if ( this.type == "radio" ) {
                if ( this.checked ) 
                    ReportTweaks.modalSettings[this.name] = this.value;
            } else {
                ReportTweaks.modalSettings[this.name] = this.value;
            }
        });
    });
    
    // Generate options for the modal window
    $("input[name=writeType]").on('change', function() {
        $("#writeStaticRow").toggle( this.value == "static" )
    } ).change();
    $("#filter_events option").each( function() {
        $("select[name=event]").append(new Option(this.text,this.value))
    });
    $.each(Object.keys(fieldForms), function() {
        $("select[name=field]").append(new Option(this,this))
    });
    
    // Load Settings
    $.each(ReportTweaks.modalSettings, function(key, setting) {
        $el = $(`.wbModal [name=${key}]`);
        if ( $el.attr('type') == "checkbox" ) {
            $el.prop('checked',setting);
        } else if ( $el.attr('type') == "radio" ) {
            $(`input[name=${key}][value=${setting}]`).prop('checked',true);
        } else {
            $el.val(setting);
        }
    });
}

$(document).ready(function () {
    $("head").append(ReportTweaks.css);
    let reportOpt = $("td:contains(Additional report options)").parent();
    reportOpt.next().after(reportOpt.prev().nextAll(':lt(2)').addBack().clone().addClass('reportTweaks'));
    $(".reportTweaks div").first().html("<i class='fas fa-tag'></i> Report Tweaks");
    $(".reportTweaks").last().find('div').remove();
    $(".reportTweaks td").last().append(ReportTweaks.html.dashboard);
    ReportTweaks.fn.loadSettings();
    $("#tweaks_config").click(ReportTweaks.fn.openModal);
    $("#save-report-btn").click(ReportTweaks.fn.saveSettings);
});