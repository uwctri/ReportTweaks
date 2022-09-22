$(document).ready(() => {

    console.log("Loaded report tweaks config")
    var $modal = $('#external-modules-configure-modal');

    $modal.on('show.bs.modal', (el) => {
        // Making sure we are overriding this modules's modal only.
        if ($(el.currentTarget).data('module') !== ReportTweaks.modulePrefix)
            return;

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld === 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstancesOld = ExternalModules.Settings.prototype.resetConfigInstances;

        ExternalModules.Settings.prototype.resetConfigInstances = function () {
            ExternalModules.Settings.prototype.resetConfigInstancesOld();

            if ($modal.data('module') !== ReportTweaks.modulePrefix)
                return;

            // Pretty up the form a bit
            $modal.find('thead').remove();
            $modal.find('tr[field=json]').hide();
            $modal.find('tr[field=info] a').on('click', () => $modal.find('tr[field=json]').toggle());
        };
    });

    $modal.on('hide.bs.modal', (el) => {
        // Making sure we are overriding this modules's modal only.
        if ($(el.currentTarget).data('module') !== ReportTweaks.modulePrefix)
            return;
        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld;
    });
});