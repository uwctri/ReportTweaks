ReportTweaks.fn = {};
ReportTweaks.html = {};
ReportTweaks.html.dashboard = `
<div style="margin:0 0 4px 20px;text-indent:-18px;">
    <input name="tweaks_removeEvent" type="checkbox"> Remove <code>redcap_event_name</code> from report.
</div>
<div style="margin:0 0 4px 20px;text-indent:-18px;">
    <input name="tweaks_merge" type="checkbox"> Attempt to combine rows representing the same record.
</div>
<div style="margin:0 0 4px 20px;text-indent:-18px;">
    <input name="tweaks_removeEmpty" type="checkbox"> Remove rows with no data (i.e. empty) other than <code>redcap_</code> variables and <code>record_id</code>.
</div>`;

ReportTweaks.fn.loadSettings = function() {
    let settings = ReportTweaks.settings[getParameterByName('report_id')];
    if (!settings)
        return;
    $.each(settings, (key,val) => $(`input[name=tweaks_${key}]`).prop('checked', val) )
}

ReportTweaks.fn.saveSettings = function() {
    let settings = {};
    $("input[name^=tweaks_]").each( (_,el) => {settings[$(el).attr('name').replace('tweaks_','')] = $(el).is(':checked')} );
    $.ajax({
        method: 'POST',
        url: ReportTweaks.router,
        data: {
            route: 'save',
            report: getParameterByName('report_id'),
            settings: JSON.stringify(settings)
        },
        error: (jqXHR, textStatus, errorThrown) => console.log(textStatus + " " +errorThrown),
        success: () => console.log('Report Tweaks Settings Saved')
    });
}

$(document).ready(function () {
    let reportOpt = $("td:contains(Additional report options)").parent();
    reportOpt.next().after(reportOpt.prev().nextAll(':lt(2)').addBack().clone().addClass('reportTweaks'));
    $(".reportTweaks div").first().html("<i class='fas fa-tag'></i> Report Tweaks");
    $(".reportTweaks").last().find('div').remove();
    $(".reportTweaks td").last().append(ReportTweaks.html.dashboard);
    ReportTweaks.fn.loadSettings();
    $("#save-report-btn").click(ReportTweaks.fn.saveSettings);
});