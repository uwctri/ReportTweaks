<template id="ReportTweaks">

    <!-- Edit Report Page -->

    <div id="rtTitle"><i class='fas fa-tag'></i> <?= $this->tt('module_name'); ?></div>

    <div id="rtDashboard">
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_includeEvent" type="checkbox"> <?= $this->tt('dash_event'); ?>
        </div>
        <div style="margin:0 0 4px 20px;text-indent:-18px;">
            <input name="tweaks_merge" type="checkbox"> <?= $this->tt('dash_combine'); ?>
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

    <div class="container wbModal" id="rtModal">
        <div class="row">
            <div class="col-3">
                <div class="nav flex-column nav-pills text-center" role="tablist">
                    <a class="nav-link active" role="tab" data-tab-count="0">---</a>
                    <a class="nav-link addNewWb" role="tab"><i class="fa-solid fa-plus"></i></a>
                </div>
            </div>
            <div class="col-9" style="border-left: grey 1px solid;">
                <div class="tab-content">
                    <div class="tab-pane show active" role="tabpanel" data-tab-count="0">
                        <div class="row" style="justify-content: right;">
                            <a class="removeWb" style="width:min-content;"><i class="fa-solid fa-xmark"></i></a>
                        </div>
                        <div class="row">
                            <label class="col-sm-4 control-label" for="modalBtn"><?= $this->tt('modal_edit_14'); ?></label>
                            <div class="col-sm-8">
                                <input name="modalBtn" type="text" placeholder="<?= $this->tt('modal_edit_2'); ?>" class="form-control input-md">
                            </div>
                        </div>
                        <div class="row">
                            <label class="col-sm-4 control-label" for="modalText"><?= $this->tt('modal_edit_15'); ?></label>
                            <div class="col-sm-8">
                                <textarea class="form-control" name="modalText" placeholder="<?= $this->tt('modal_edit_3'); ?>"></textarea>
                            </div>
                        </div>
                        <div class="row">
                            <label class="col-sm-4 control-label" for="footer"><?= $this->tt('modal_edit_16'); ?></label>
                            <div class="col-sm-8">
                                <textarea class="form-control" name="footer"></textarea>
                            </div>
                        </div>
                        <div class="row">
                            <label class="col-sm-4 control-label" for="event"><?= $this->tt('modal_edit_4'); ?></label>
                            <div class="col-sm-8">
                                <select name="event" class="form-control">
                                    <option value=""><?= $this->tt('modal_edit_5'); ?></option>
                                </select>
                            </div>
                        </div>
                        <div class="row">
                            <label class="col-md-4 control-label" for="fieldType"><?= $this->tt('modal_edit_17'); ?></label>
                            <div class="col-md-8 text-left">
                                <div class="radio">
                                    <label for="fieldType-static">
                                        <input type="radio" name="fieldType_0" value="static" checked="checked">
                                        <?= $this->tt('modal_edit_18'); ?>
                                    </label>
                                </div>
                                <div class="radio">
                                    <label for="fieldType-map">
                                        <input type="radio" name="fieldType_0" value="map">
                                        <?= $this->tt('modal_edit_19'); ?>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <label class="col-sm-4 control-label" for="fieldName"><?= $this->tt('modal_edit_6'); ?></label>
                            <div class="col-sm-8">
                                <select name="fieldName" class="form-control">
                                </select>
                            </div>
                        </div>
                        <div class="row" style="display:none">
                            <label class="col-sm-4 control-label" for="fieldMap"><?= $this->tt('modal_edit_20'); ?></label>
                            <div class="col-sm-8">
                                <textarea class="form-control" name="fieldMap" placeholder="<?= $this->tt('modal_edit_21'); ?>"></textarea>
                            </div>
                        </div>
                        <div class="row">
                            <label class="col-md-4 control-label" for="writeType"><?= $this->tt('modal_edit_7'); ?></label>
                            <div class="col-md-8 text-left">
                                <div class="radio">
                                    <label for="writeType-ask">
                                        <input type="radio" name="writeType_0" value="ask" checked="checked">
                                        <?= $this->tt('modal_edit_8'); ?>
                                    </label>
                                </div>
                                <div class="radio">
                                    <label for="writeType-static">
                                        <input type="radio" name="writeType_0" value="static">
                                        <?= $this->tt('modal_edit_9'); ?>
                                    </label>
                                </div>
                                <div class="radio">
                                    <label for="writeType-today">
                                        <input type="radio" name="writeType_0" value="today">
                                        <?= $this->tt('modal_edit_10'); ?>
                                    </label>
                                </div>
                                <div class="radio">
                                    <label for="writeType-username">
                                        <input type="radio" name="writeType_0" value="username">
                                        <?= $this->tt('modal_edit_13'); ?>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="row" style="display:none">
                            <label class="col-sm-4 control-label" for="writeStatic"><?= $this->tt('modal_edit_7'); ?></label>
                            <div class="col-sm-8">
                                <input name="writeStatic" type="text" placeholder="" class="form-control input-md">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-sm-2"></div>
                            <div class="col-sm-10 text-left">
                                <div class="checkbox">
                                    <label for="overwrites">
                                        <input type="checkbox" name="overwrites" value="1">
                                        <?= $this->tt('modal_edit_11'); ?>
                                    </label>
                                </div>
                                <div class="checkbox">
                                    <label for="increment">
                                        <input type="checkbox" name="increment" value="1">
                                        <?= $this->tt('modal_edit_12'); ?>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
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
                <input type='checkbox' class='checkbox-inline' id='hideEventCol'>
            </div>
            <div class="col-md-7">
                <span class="font-weight-bold"><?= $this->tt('hide_repeat'); ?>: </span>
                <input type='checkbox' class='checkbox-inline' id='hideRepeatCols'>
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