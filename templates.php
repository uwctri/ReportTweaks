<template id="ReportTweaks">

    <!-- Edit Report Page -->

    <div id="rtTitle"><i class='fas fa-tag'></i> <?= $this->tt('module_name'); ?></div>

    <div id="rtDashboard">
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_includeEvent" type="checkbox"> <?= $this->tt('dash_event'); ?>
        </div>
        <div style="margin:0 0 6px 20px;text-indent:-18px;">
            <span><?= $this->tt('dash_reshape'); ?></span>
            <select name="tweaks_reshapeMode" class="ml-1 fs12">
                <option value="none"><?= $this->tt('dash_reshape_none'); ?></option>
                <option value="merge"><?= $this->tt('dash_reshape_merge'); ?></option>
                <option value="wide_pivot"><?= $this->tt('dash_reshape_wide'); ?></option>
            </select>
        </div>
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_fillCore" type="checkbox"> <?= $this->tt('dash_fill_core'); ?>
            <div style="margin:2px 0 2px 20px;text-indent:-18px;">
                <input name="tweaks_dropCoreRows" type="checkbox"> <?= $this->tt('dash_drop_core'); ?>
            </div>
        </div>
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_removeEmpty" type="checkbox"> <?= $this->tt('dash_empty'); ?>
        </div>
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_reportLogic" type="checkbox"> <?= $this->tt('dash_report_logic'); ?>
        </div>
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_dateRange" type="checkbox"> <?= $this->tt('dash_range'); ?>
        </div>
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_collapse" type="checkbox"> <?= $this->tt('dash_collapse'); ?>
        </div>
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_writeback" type="checkbox"> <?= $this->tt('dash_writeback'); ?> <br /> <span id="openWriteBackModal"><i class="fas fa-cog ml-3" style="color:grey"></i><?= $this->tt('dash_config'); ?></span>
        </div>
    </div>

    <select id="rtDateRangeField" class="ml-2 fs12">
        <option value=""></option>
    </select>

    <div class="modal fade" id="rtWritebackModal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <div class="modal-header bg-light">
                    <h5 class="modal-title"><i class="fas fa-database mr-2"></i><?= $this->tt('modal_edit_1'); ?></h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-3 border-right">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <strong class="fs13">Buttons</strong>
                                <button type="button" class="btn btn-xs btn-outline-primary" id="rtAddWbBtn">
                                    <i class="fas fa-plus"></i> Add
                                </button>
                            </div>
                            <div class="list-group" id="rtWbBtnList"></div>
                        </div>
                        <div class="col-md-9" id="rtWbEditorPane">
                            <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                                <h6 class="mb-0 font-weight-bold" id="rtWbEditorTitle">Button Settings</h6>
                                <button type="button" class="btn btn-xs btn-outline-danger" id="rtDeleteWbBtn">
                                    <i class="fas fa-trash"></i> Remove Button
                                </button>
                            </div>
                            <div class="form-row">
                                <div class="form-group col-md-4">
                                    <label class="font-weight-bold fs12"><?= $this->tt('modal_edit_14'); ?></label>
                                    <input type="text" class="form-control form-control-sm" id="rtWbModalBtn" placeholder="<?= $this->tt('modal_edit_2'); ?>">
                                </div>
                                <div class="form-group col-md-8">
                                    <label class="font-weight-bold fs12"><?= $this->tt('modal_edit_16'); ?></label>
                                    <input type="text" class="form-control form-control-sm" id="rtWbFooter" placeholder="Optional footer HTML">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="font-weight-bold fs12"><?= $this->tt('modal_edit_15'); ?></label>
                                <textarea class="form-control form-control-sm" id="rtWbModalText" rows="2" placeholder="<?= $this->tt('modal_edit_3'); ?>"></textarea>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-3 mb-2">
                                <strong class="fs13">Target Field Rules</strong>
                                <button type="button" class="btn btn-xs btn-outline-success" id="rtAddTargetBtn">
                                    <i class="fas fa-plus"></i> Add Field Rule
                                </button>
                            </div>
                            <div id="rtWbTargetsContainer"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="rtSaveWbModal">Save Writeback Config</button>
                </div>
            </div>
        </div>
    </div>

    <!-- View Report Page -->

    <a id="rtShowDescription" role="button">
        <i class="fa-solid fa-angles-down"></i> <?= $this->tt('collapse'); ?>
    </a>

    <button id="rtLogic" class="report_btn jqbuttonmed ui-button ui-corner-all ui-widget" style="font-size:12px;"><i class="fas fa-filter fs10"></i> BtnLabel</button>

    <div id="rtLogicDisplay" class="collapse mt-4 mb-4 p-2 border rounded" style="background: #d3d3d3"> <code>LogicText</code></div>

    <a href="#" id="rtCopyDataBtn" class="btn btn-secondary btn-sm mb-1" role="button"><i class="fas fa-clipboard"></i></a>

    <div id="rtFilters">
        <span class="dataTables_filter">
            <label><input type="text" placeholder="Maximum" id="tableFilterMax" tabindex=3></label>
        </span>
        <span class="dataTables_filter">
            <label><input type="text" placeholder="Minimum" id="tableFilterMin" tabindex=2></label>
        </span>
        <span class="dataTables_filter">
            <select id="minmaxpivot">
                <option value="" selected disabled hidden><?= $this->tt('filter'); ?></option>
            </select>
        </span>
    </div>

    <div id="rtCheckboxes" class="container p-0 mt-1" style="max-width:420px">
        <div class="row no-gutters">
            <div class="col-md-5">
                <span class="font-weight-bold"><?= $this->tt('hide_event'); ?>: </span>
                <input type='checkbox' style="vertical-align: middle;" class='checkbox-inline' id='hideEventCol'>
            </div>
            <div class="col-md-7">
                <span class="font-weight-bold"><?= $this->tt('hide_repeat'); ?>: </span>
                <input type='checkbox' style="vertical-align: middle;" class='checkbox-inline' id='hideRepeatCols'>
            </div>
        </div>
        <div class="row no-gutters">
            <div class="col-md-12">
                <span class="font-weight-bold"><?= $this->tt('live_date'); ?>: </span>
                <select id='filterDateRange'>
                    <option value="-1"></option>
                    <option value="1"><?= $this->tt('dropdown_1'); ?></option>
                    <option value="7"><?= $this->tt('dropdown_7'); ?></option>
                    <option value="14"><?= $this->tt('dropdown_14'); ?></option>
                    <option value="30"><?= $this->tt('dropdown_30'); ?></option>
                    <option value="60"><?= $this->tt('dropdown_60'); ?></option>
                    <option value="90"><?= $this->tt('dropdown_90'); ?></option>
                    <option value="365"><?= $this->tt('dropdown_365'); ?></option>
                </select>
            </div>
        </div>
    </div>

    <div style='margin-top:10px;' id="rtModalBtn">
        <button class="tweaks_writeback report_btn jqbuttonmed ui-button ui-corner-all ui-widget" style="font-size:12px;" data-btn-count="BtnNumber">
            <i class="fas fa-pencil-alt fs10"></i> BtnLabel
        </button>
    </div>

    <div class="form-group mb-0" id="rtModalInput">
        <label class='font-weight-bold float-left mt-4'>LabelText</label>
        <input type="text" class="swal2-input mt-0 mb-0" id="newID">
    </div>

</template>