<template>

<div id="rtTitle"><i class='fas fa-tag'></i> Report Tweaks<div>

<div id="rtDashboard">
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_includeEvent" type="checkbox"> Include <code>redcap_event_name</code> in the report.
    </div>
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_merge" type="checkbox"> Combine rows representing the same record.
    </div>
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_removeEmpty" type="checkbox"> Remove rows with no data (i.e. empty) other than <code>redcap_</code> variables and <code>record_id</code>.
    </div>
    <div style="margin:0 0 4px 20px;text-indent:-18px;">
        <input name="tweaks_writeback" type="checkbox"> Add a button to write data back to the database. Useful for removing records from a report or flagging records as reviewed. <br/> <span id="openWriteBackModal"><i class="fas fa-cog ml-3" style="color:grey"></i>Configure</span>
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
</template>