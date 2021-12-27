ReportTweaks.fn = {};
ReportTweaks.modalSettings = {};

/*
Load existing settings and populate the choices onto the page
*/
ReportTweaks.fn.loadSettings = function() {
    $.each(ReportTweaks.settings, (key, val) => $(`input[name=tweaks_${key}]`).prop('checked', val));
    ReportTweaks.modalSettings = ReportTweaks.settings['_wb'] || ReportTweaks.modalSettings;
    if ( !ReportTweaks.isLong ) {
        $("[name=tweaks_includeEvent]").prop('disabled', true);
    }
}

/*
Load existing settings and populate the choices onto the page
*/
ReportTweaks.fn.saveSettings = function() {

    let settings = {};

    // Collect all current settings 
    $("input[name^=tweaks_]").each((_, el) => {
        settings[$(el).attr('name').replace('tweaks_', '')] = $(el).is(':checked')
    });
    settings['_wb'] = ReportTweaks.modalSettings;
    settings['dateField'] = $("#rtDateRangeField").val();

    // Post back to DB
    $.ajax({
        method: 'POST',
        url: ReportTweaks.router,
        data: {
            route: 'saveConfig',
            report: ReportTweaks.em.getUrlParameter('report_id'),
            settings: JSON.stringify(settings),
            redcap_csrf_token: ReportTweaks.csrf
        },
        error: (jqXHR, textStatus, errorThrown) => console.log(`${jqXHR}\n${textStatus}\n${errorThrown}`),
        success: () => console.log("Report Tweaks Settings Saved")
    });
}

/*
Display the Write back config modal, load current settings & save settins on close
*/
ReportTweaks.fn.openModal = function() {

    Swal.fire({
        title: ReportTweaks.em.tt('modal_edit_1'),
        html: ReportTweaks.html.rtModal,
        customClass: {
            container: 'writeBackModal'
        }
    }).then(() => {

        // Save settings on close, not written to DB
        ReportTweaks.modalSettings = {};
        $(".wbModal").find('input, select, textarea').each(function() {
            if (this.type == "checkbox") {
                ReportTweaks.modalSettings[this.name] = this.checked;
            } else if (this.type == "radio") {
                if (this.checked)
                    ReportTweaks.modalSettings[this.name] = this.value;
            } else {
                ReportTweaks.modalSettings[this.name] = this.value;
            }
        });
    });

    // Generate options for the modal window
    $("input[name=writeType]").on('change', function() {
        $("#writeStaticRow").toggle(this.value == "static")
    }).change();
    let dropdown = $("select[name=event]");
    $("#filter_events option").each(function() {
        dropdown.append(new Option(this.text, this.value))
    });
    dropdown = $("select[name=field]");
    $.each(Object.keys(fieldForms), function() {
        dropdown.append(new Option(this, this))
    });

    // Load Existing Writeback Settings
    $.each(ReportTweaks.modalSettings, function(key, setting) {
        $el = $(`.wbModal [name=${key}]`);
        if ($el.attr('type') == "checkbox") {
            $el.prop('checked', setting);
        } else if ($el.attr('type') == "radio") {
            $(`input[name=${key}][value=${setting}]`).prop('checked', true);
        } else {
            $el.val(setting);
        }
    });
}

$(document).ready(function() {

    // Load the templates
    ReportTweaks.html = {};
    $.each($("template[id=ReportTweaks]").prop('content').children, (_, el) =>
        ReportTweaks.html[$(el).prop('id')] = $(el).prop('outerHTML'));

    // Insert a new box area for our custom settings
    let reportOpt = $("input[name=filter_type]").closest('tr').prevAll().eq(2);
    reportOpt.next().after(reportOpt.prev().nextAll(':lt(2)').addBack().clone().addClass('reportTweaks'));

    // Style the box with title, populate with template
    $(".reportTweaks div").first().html(ReportTweaks.html.rtTitle);
    $(".reportTweaks").last().find('div').remove();
    $(".reportTweaks td").last().append(ReportTweaks.html.rtDashboard);
    
    // Setup the Date range field
    $(".reportTweaks [name=tweaks_dateRange]").parent().append(ReportTweaks.html.rtDateRangeField);
    dropdown = $("#rtDateRangeField");
    $.each(Object.keys(fieldForms), function() {
        dropdown.append(new Option(this, this))
    });
    
    // Load settings and prep them clicks (or, if new report, disable the buttons)
    ReportTweaks.fn.loadSettings();
    if (ReportTweaks.em.getUrlParameter('report_id')) {
        $("#openWriteBackModal").click(ReportTweaks.fn.openModal);
        $("#save-report-btn").click(ReportTweaks.fn.saveSettings);
    } else {
        $("input[name^=tweaks_]").prop('disabled', true);
    }
});