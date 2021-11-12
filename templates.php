<template>

<!-- Edit Report Page -->

<div id="rtTitle"><i class='fas fa-tag'></i> <?=$this->tt('module_name'); ?></div>

<div id="rtDashboard">
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_includeEvent" type="checkbox"> <?=$this->tt('dash_event'); ?>
    </div>
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_merge" type="checkbox"> <?=$this->tt('dash_combine'); ?>
    </div>
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_removeEmpty" type="checkbox"> <?=$this->tt('dash_empty'); ?>
    </div>
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_writeback" type="checkbox"> <?=$this->tt('dash_writeback'); ?> <br/> <span id="openWriteBackModal"><i class="fas fa-cog ml-3" style="color:grey"></i><?=$this->tt('dash_config'); ?></span>
    </div>
</div>

<div class="container wbModal" id="rtModal">
    <div class="row">
        <label class="col-sm-4 control-label" for="modalBtn">Button Text</label>  
        <div class="col-sm-8">
            <input id="modalBtn" name="modalBtn" type="text" placeholder="Mark as Complete" class="form-control input-md">
        </div>
    </div>
    <div class="row">
        <label class="col-sm-4 control-label" for="modalText">Popup Message</label>
        <div class="col-sm-8">                     
            <textarea class="form-control" id="modalText" name="modalText" placeholder="Explination here. You can use HTML tags!"></textarea>
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
</div>

<!-- View Report Page -->

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
            <option value="" selected disabled hidden>Filter Range On...</option>
        </select>
    </span>
</div>

<div id="rtCheckboxes" class="container p-0 mt-1" style="max-width:420px">
    <div class="row no-gutters">
        <div class="col-md-5">
            <span class="font-weight-bold">Hide Event Column: </span>
            <input type='checkbox' class='checkbox-inline' id='hideEventCol'>
        </div>
        <div class="col-md-7">
            <span class="font-weight-bold">Hide Repeating Form Columns: </span>
            <input type='checkbox' class='checkbox-inline' id='hideRepeatCols'>
        </div>
    </div>
</div>

<div style='margin-top:10px;' id="rtModalBtn">
    <button class="tweaks_writeback report_btn jqbuttonmed ui-button ui-corner-all ui-widget" style="font-size:12px;">
        <i class="fas fa-pencil-alt fs10"></i> BtnLabel
    </button>
</div>

<div class="form-group mb-0" id="rtModalInput">
    <label class='font-weight-bold float-left mt-4'>LabelText</label>
    <input type="text" class="swal2-input mt-0 mb-0" id="newID">
</div>

</template>