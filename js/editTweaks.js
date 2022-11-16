ReportTweaks.fn = {};
ReportTweaks.modalSettings = {};

/*
Load existing settings and populate the choices onto the page
*/
ReportTweaks.fn.loadSettings = () => {
    $.each(ReportTweaks.settings, (key, val) => $(`input[name=tweaks_${key}]`).prop('checked', val));
    $("#rtDateRangeField").val(ReportTweaks.settings['dateField']);
    ReportTweaks.modalSettings = ReportTweaks.settings['_wb'] || ReportTweaks.modalSettings;
    if (!ReportTweaks.isLong) {
        $("[name=tweaks_includeEvent]").prop('disabled', true);
    }
}

/*
Load existing settings and populate the choices onto the page
*/
ReportTweaks.fn.saveSettings = () => {

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
ReportTweaks.fn.openModal = () => {

    const addNewTab = () => {
        let count = $(".wbModal .nav-link").length - 1;
        $modal.find(".active, .show").removeClass("active show");
        const $link = $(".wbModal .nav-link").last();
        $link.clone().insertAfter($link.prev()).attr("data-tab-count", count).addClass("active").removeClass("addNewWb").text("---");
        const $content = $(".wbModal .tab-pane").last();
        const $clone = $content.clone();
        $clone.find("[name^=writeType]").prop("name", `writeType_${count}`);
        $clone.find("[name^=fieldType]").prop("name", `fieldType_${count}`);
        $clone.insertAfter($content).attr("data-tab-count", count).addClass("active show");
        $(`.wbModal [data-tab-count=${count}]`).find("textarea, [type=text], select").val("").prop("checked", false);
    }

    Swal.fire({
        title: ReportTweaks.em.tt('modal_edit_1'),
        html: ReportTweaks.html.rtModal,
        customClass: {
            container: 'writeBackModal'
        }
    }).then(() => {

        // Save settings on close, not written to DB
        ReportTweaks.modalSettings = [];
        $(".wbModal .tab-pane").each((index, el) => {
            ReportTweaks.modalSettings.push({});
            $(el).find('input, select, textarea').each((_, input) => {
                let name = input.name.split("_")[0];
                if (input.type == "checkbox") {
                    ReportTweaks.modalSettings[index][name] = input.checked;
                } else if (input.type == "radio") {
                    if (input.checked)
                        ReportTweaks.modalSettings[index][name] = input.value;
                } else {
                    ReportTweaks.modalSettings[index][name] = input.value;
                }
            });
        });
    });

    const $modal = $(".wbModal");

    // Reformat old to new wb settings
    if (!ReportTweaks.modalSettings[0]) {
        let tmp = ReportTweaks.modalSettings
        delete ReportTweaks.modalSettings;
        ReportTweaks.modalSettings = [];
        ReportTweaks.modalSettings[0] = tmp;
    }

    // Setup Remove button
    $modal.on("click", ".removeWb", (el) => {
        let tab = $(el.currentTarget).closest(".tab-pane").data("tab-count");
        if (tab == 0) {
            $modal.find("[data-tab-count=0]").find("textarea, [type=text], select").val("").prop("checked", false).change();
            $modal.find(".nav-link[data-tab-count=0]").text("---")
            return;
        }
        $modal.find(".active, .show").removeClass("active show");
        $modal.find("[data-tab-count=0]").addClass("active show");
        $modal.find(`[data-tab-count=${tab}]`).remove();
    });

    // Setup add new btn click
    $modal.on("click", ".addNewWb", addNewTab);

    // Setup button labels
    $modal.on("change", "input[name=modalBtn]", (el) => {
        let tab = $(el.currentTarget).closest(".tab-pane").data("tab-count");
        $(`.wbModal .nav-link[data-tab-count=${tab}]`).text(el.currentTarget.value);
    });

    // Setup button actions
    $modal.on("click", ".nav-link", (el) => {
        const tab = $(el.currentTarget).data("tab-count");
        if (!isinteger(tab)) return;
        $modal.find(".active, .show").removeClass("active show");
        $(`.wbModal [data-tab-count=${tab}]`).addClass("active show");
    });

    // Form interactiviity
    $modal.on("change", "input[name^=writeType]", (el) => $(el.currentTarget).closest(".row").next().toggle(el.currentTarget.value == "static"));
    $modal.on("change", "input[name^=fieldType]", (el) => {
        $saticField = $(el.currentTarget).closest(".row").next();
        $saticField.toggle(el.currentTarget.value == "static");
        $saticField.next().toggle(el.currentTarget.value != "static");
    });
    $modal.on("change", "select[name=event]", (el) => $(el.currentTarget).closest(".row").next().toggle(el.currentTarget.value == "").change());

    // Generate options for the modal window
    let modalEvent = $modal.find("select[name=event]");
    $("#filter_events option").each((_, el) => modalEvent.append(new Option(el.text, el.value)));
    let modalField = $modal.find("select[name=fieldName]");
    Object.keys(fieldForms).forEach((el) => modalField.append(new Option(el, el)));

    // Modify the HTML if we have multiple tabs
    if (ReportTweaks.modalSettings.length > 1) {
        for (let i = 1; i < ReportTweaks.modalSettings.length; i++) {
            addNewTab();
        }
        $(".wbModal input[name=modalBtn]").change();
    }

    // Load Existing Writeback Settings
    $.each(ReportTweaks.modalSettings, (index, data) => {
        $(`.wbModal .nav-link[data-tab-count=${index}]`).text(data["modalBtn"] || "")
        $.each(data, (key, setting) => {
            key = key == "field" ? "fieldName" : key;
            $tab = $(`.wbModal [data-tab-count=${index}]`);
            $el = $tab.find(`[name^=${key}]`);
            if ($el.attr('type') == "checkbox") {
                $el.prop('checked', setting);
            } else if ($el.attr('type') == "radio") {
                $tab.find(`[value=${setting}]`).prop('checked', true).change();
            } else if ($el.attr('name') == "fieldMap") {
                let str = "";
                Object.entries(setting).forEach((entry) => {
                    const [key, value] = entry;
                    str = str + `${key}, ${value}\n`;
                });
                $el.val(str.trim());
            } else {
                $el.val(setting).change();
            }
        });
    });
}

$(document).ready(() => {

    // Load the templates
    ReportTweaks.html = {};
    $.each($("template[id=ReportTweaks]").prop('content').children, (_, el) =>
        ReportTweaks.html[$(el).prop('id')] = $(el).prop('outerHTML'));

    // Insert a new box area for our custom settings
    let reportOpt = $("div[id=how_to_filters_link]").closest('tr').prevAll().eq(2);
    reportOpt.next().after(reportOpt.prev().nextAll(':lt(2)').addBack().clone().addClass('reportTweaks'));

    // Style the box with title, populate with template
    $(".reportTweaks div").first().html(ReportTweaks.html.rtTitle);
    $(".reportTweaks").last().find('div').remove();
    $(".reportTweaks td").last().append(ReportTweaks.html.rtDashboard);

    // Setup the Date range field
    $(".reportTweaks [name=tweaks_dateRange]").parent().append(ReportTweaks.html.rtDateRangeField);
    let dropdown = $("#rtDateRangeField");
    ReportTweaks.fields.forEach((el) => dropdown.append(new Option(el, el)));

    // Load settings and prep them clicks (or, if new report, disable the buttons)
    ReportTweaks.fn.loadSettings();
    if (ReportTweaks.em.getUrlParameter('report_id')) {
        $("#openWriteBackModal").on('click', ReportTweaks.fn.openModal);
        $("#save-report-btn").on('click', ReportTweaks.fn.saveSettings);
    } else {
        $("input[name^=tweaks_]").prop('disabled', true);
    }
});