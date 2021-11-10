ReportTweaks.fn = {};
ReportTweaks.modalSettings = {};

/*
Load existing settings and populate the choices onto the page
*/
ReportTweaks.fn.loadSettings = function() {
    let settings = ReportTweaks.settings[getParameterByName('report_id')] || ReportTweaks.defaultSettings;
    $.each(settings, (key, val) => $(`input[name=tweaks_${key}]`).prop('checked', val));
    ReportTweaks.modalSettings = settings['_wb'] || ReportTweaks.modalSettings;
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

    // Post back to DB
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

/*
Display the Write back config modal, load current settings & save settins on close
*/
ReportTweaks.fn.openModal = function() {

    Swal.fire({
        title: 'DB Writeback Config',
        html: ReportTweaks.html.find('#rtModal').html(),
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
    ReportTweaks.html = $($("template").prop('content'));

    // Insert a new box area for our custom settings
    let reportOpt = $("td:contains(Additional report options)").parent();
    reportOpt.next().after(reportOpt.prev().nextAll(':lt(2)').addBack().clone().addClass('reportTweaks'));

    // Style the box with title, populate with template
    $(".reportTweaks div").first().html(ReportTweaks.html.find('#rtTitle').html());
    $(".reportTweaks").last().find('div').remove();
    $(".reportTweaks td").last().append(ReportTweaks.html.find('#rtDashboard').html());

    // Load settings and prep them clicks
    ReportTweaks.fn.loadSettings();
    $("#openWriteBackModal").click(ReportTweaks.fn.openModal);
    $("#save-report-btn").click(ReportTweaks.fn.saveSettings);
});