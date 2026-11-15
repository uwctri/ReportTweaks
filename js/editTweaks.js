$(document).ready(() => {

    const module = ExternalModules.UWMadison.ReportTweaks;
    let modalSettings = [];
    let html = {};

    const createEmptyTarget = () => ({
        event: '',
        fieldType: 'static',
        fieldName: '',
        fieldMap: {},
        writeType: 'ask',
        writeStatic: '',
        overwrites: false,
        increment: false
    });

    const createEmptyButton = () => ({
        modalBtn: '',
        modalText: '',
        footer: '',
        targets: [createEmptyTarget()]
    });

    /*
    Normalize legacy _wb formats (single object, flat array, or '^' chained items)
    into the structured [{ modalBtn, modalText, footer, targets: [...] }] format.
    */
    const normalizeWbSettings = (raw) => {
        if (!raw) return [createEmptyButton()];
        const arr = Array.isArray(raw) ? raw : [raw];
        if (arr.length === 0) return [createEmptyButton()];

        const normalized = [];
        arr.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            if (Array.isArray(item.targets)) {
                normalized.push({
                    modalBtn: item.modalBtn || '',
                    modalText: item.modalText || '',
                    footer: item.footer || '',
                    targets: item.targets.length ? item.targets.map((t) => ({ ...createEmptyTarget(), ...t })) : [createEmptyTarget()]
                });
                return;
            }

            const target = {
                event: item.event || '',
                fieldType: item.fieldType || 'static',
                fieldName: item.fieldName || item.field || '',
                fieldMap: item.fieldMap || {},
                writeType: item.writeType || 'ask',
                writeStatic: item.writeStatic || '',
                overwrites: !!item.overwrites,
                increment: !!item.increment
            };

            if (item.modalBtn === '^' && normalized.length > 0) {
                normalized[normalized.length - 1].targets.push(target);
            } else {
                normalized.push({
                    modalBtn: item.modalBtn || '',
                    modalText: item.modalText || '',
                    footer: item.footer || '',
                    targets: [target]
                });
            }
        });

        return normalized.length ? normalized : [createEmptyButton()];
    };

    const loadSettings = () => {
        if (module.settings) {
            $.each(module.settings, (key, val) => {
                const $el = $(`[name=tweaks_${key}]`);
                if ($el.is(':checkbox')) {
                    $el.prop('checked', !!val);
                } else if ($el.is('select, input')) {
                    $el.val(val);
                }
            });
            if (!module.settings.reshapeMode && module.settings.merge) {
                $("[name=tweaks_reshapeMode]").val('merge');
            }
            $("#rtDateRangeField").val(module.settings['dateField']);
            modalSettings = normalizeWbSettings(module.settings['_wb']);
        } else {
            modalSettings = [createEmptyButton()];
        }

        if (!module.isLong) {
            $("[name=tweaks_includeEvent]").prop('disabled', true);
        }

        const toggleDropCore = () => {
            const enabled = $("[name=tweaks_fillCore]").is(':checked');
            $("[name=tweaks_dropCoreRows]").prop('disabled', !enabled);
            if (!enabled) $("[name=tweaks_dropCoreRows]").prop('checked', false);
        };
        $("[name=tweaks_fillCore]").on('change', toggleDropCore);
        toggleDropCore();

        const toggleWritebackConfig = () => {
            const enabled = $("[name=tweaks_writeback]").is(':checked');
            $("#openWriteBackModal").toggle(enabled);
        };
        $("[name=tweaks_writeback]").on('change', toggleWritebackConfig);
        toggleWritebackConfig();
    };

    const saveSettings = () => {
        let settings = {};
        $("[name^=tweaks_]").each((_, el) => {
            const key = $(el).attr('name').replace('tweaks_', '');
            settings[key] = $(el).is(':checkbox') ? $(el).is(':checked') : $(el).val();
        });
        settings['merge'] = settings['reshapeMode'] === 'merge';
        settings['_wb'] = modalSettings;
        settings['dateField'] = $("#rtDateRangeField").val();

        module.ajax('save_report_config', {
            report: module.getUrlParameter('report_id'),
            settings: settings
        }).then((res) => {
            if (!res || !res.success) {
                console.error('Report Tweaks Save Error:', res?.error || res);
                return;
            }
            console.log("Report Tweaks Settings Saved");
        }).catch((err) => console.error('Report Tweaks Save Error:', err));
    };

    /*
    Bootstrap Writeback Configuration Modal (replaces legacy Swal cloned-DOM tabs)
    */
    const openModal = () => {
        if (!$('#rtWritebackModal').length) {
            $('body').append(html.rtWritebackModal);
        }

        let draft = JSON.parse(JSON.stringify(normalizeWbSettings(modalSettings)));
        let activeIdx = 0;

        const $modal = $('#rtWritebackModal');
        const eventOptions = [];
        $("#filter_events option").each((_, el) => eventOptions.push({ value: el.value, text: el.text }));
        const fieldOptions = typeof fieldForms !== 'undefined' ? Object.keys(fieldForms) : [];

        const escapeHtml = (str) => $('<div>').text(str ?? '').html();

        const syncEditorToDraft = () => {
            const btn = draft[activeIdx];
            if (!btn) return;
            btn.modalBtn = $('#rtWbModalBtn').val();
            btn.footer = $('#rtWbFooter').val();
            btn.modalText = $('#rtWbModalText').val();

            const targets = [];
            $('#rtWbTargetsContainer .rt-target-card').each((_, card) => {
                const $c = $(card);
                const mapObj = {};
                const mapRaw = $c.find('.rt-t-fieldmap').val() || '';
                mapRaw.split('\n').forEach((line) => {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.includes(',')) return;
                    const [k, v] = trimmed.split(',');
                    if (k.trim() && v !== undefined) {
                        mapObj[k.trim()] = v.trim();
                    }
                });

                targets.push({
                    event: $c.find('.rt-t-event').val() || '',
                    fieldType: $c.find('.rt-t-fieldtype').val() || 'static',
                    fieldName: $c.find('.rt-t-fieldname').val() || '',
                    fieldMap: mapObj,
                    writeType: $c.find('.rt-t-writetype').val() || 'ask',
                    writeStatic: $c.find('.rt-t-writestatic').val() || '',
                    overwrites: $c.find('.rt-t-overwrites').is(':checked'),
                    increment: $c.find('.rt-t-increment').is(':checked')
                });
            });
            btn.targets = targets.length ? targets : [createEmptyTarget()];
        };

        const renderTargetCard = (target, tIdx) => {
            const evHtml = `<option value="">${escapeHtml(module.tt('modal_edit_5'))}</option>` +
                eventOptions.map((o) => `<option value="${escapeHtml(o.value)}" ${o.value == target.event ? 'selected' : ''}>${escapeHtml(o.text)}</option>`).join('');

            const fldHtml = `<option value="">-- Select Field --</option>` +
                fieldOptions.map((f) => {
                    const formName = typeof fieldForms !== 'undefined' && fieldForms[f] ? ` (${fieldForms[f]})` : '';
                    return `<option value="${escapeHtml(f)}" ${f === target.fieldName ? 'selected' : ''}>${escapeHtml(f + formName)}</option>`;
                }).join('');

            const mapStr = Object.entries(target.fieldMap || {}).map(([k, v]) => `${k}, ${v}`).join('\n');
            const isMap = target.fieldType === 'map';
            const isStaticWrite = target.writeType === 'static';

            return `
                <div class="card mb-2 rt-target-card" data-target-idx="${tIdx}">
                    <div class="card-body p-2 bg-light">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge badge-secondary">Field Rule #${tIdx + 1}</span>
                            <button type="button" class="btn btn-xs btn-link text-danger rt-remove-target p-0" title="Remove rule">
                                <i class="fas fa-times"></i> Remove
                            </button>
                        </div>
                        <div class="form-row">
                            <div class="form-group col-md-4 mb-2">
                                <label class="fs11 font-weight-bold mb-1">${escapeHtml(module.tt('modal_edit_4'))}</label>
                                <select class="form-control form-control-sm rt-t-event">${evHtml}</select>
                            </div>
                            <div class="form-group col-md-3 mb-2">
                                <label class="fs11 font-weight-bold mb-1">${escapeHtml(module.tt('modal_edit_17'))}</label>
                                <select class="form-control form-control-sm rt-t-fieldtype">
                                    <option value="static" ${!isMap ? 'selected' : ''}>${escapeHtml(module.tt('modal_edit_18'))}</option>
                                    <option value="map" ${isMap ? 'selected' : ''}>${escapeHtml(module.tt('modal_edit_19'))}</option>
                                </select>
                            </div>
                            <div class="form-group col-md-5 mb-2 rt-t-fieldname-wrap" style="${isMap ? 'display:none;' : ''}">
                                <label class="fs11 font-weight-bold mb-1">${escapeHtml(module.tt('modal_edit_6'))}</label>
                                <select class="form-control form-control-sm rt-t-fieldname">${fldHtml}</select>
                            </div>
                            <div class="form-group col-md-5 mb-2 rt-t-fieldmap-wrap" style="${isMap ? '' : 'display:none;'}">
                                <label class="fs11 font-weight-bold mb-1">${escapeHtml(module.tt('modal_edit_20'))}</label>
                                <textarea class="form-control form-control-sm rt-t-fieldmap" rows="2" placeholder="${escapeHtml(module.tt('modal_edit_21'))}">${escapeHtml(mapStr)}</textarea>
                            </div>
                        </div>
                        <div class="form-row align-items-center">
                            <div class="form-group col-md-4 mb-1">
                                <label class="fs11 font-weight-bold mb-1">${escapeHtml(module.tt('modal_edit_7'))}</label>
                                <select class="form-control form-control-sm rt-t-writetype">
                                    <option value="ask" ${target.writeType === 'ask' ? 'selected' : ''}>${escapeHtml(module.tt('modal_edit_8'))}</option>
                                    <option value="static" ${target.writeType === 'static' ? 'selected' : ''}>${escapeHtml(module.tt('modal_edit_9'))}</option>
                                    <option value="today" ${target.writeType === 'today' ? 'selected' : ''}>${escapeHtml(module.tt('modal_edit_10'))}</option>
                                    <option value="username" ${target.writeType === 'username' ? 'selected' : ''}>${escapeHtml(module.tt('modal_edit_13'))}</option>
                                </select>
                            </div>
                            <div class="form-group col-md-4 mb-1 rt-t-writestatic-wrap" style="${isStaticWrite ? '' : 'display:none;'}">
                                <label class="fs11 font-weight-bold mb-1">Static Value</label>
                                <input type="text" class="form-control form-control-sm rt-t-writestatic" value="${escapeHtml(target.writeStatic)}">
                            </div>
                            <div class="form-group col-md-4 mb-1 pt-3">
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input rt-t-overwrites" type="checkbox" ${target.overwrites ? 'checked' : ''}>
                                    <label class="form-check-label fs11">${escapeHtml(module.tt('modal_edit_11'))}</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input rt-t-increment" type="checkbox" ${target.increment ? 'checked' : ''}>
                                    <label class="form-check-label fs11">${escapeHtml(module.tt('modal_edit_12'))}</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderModal = () => {
            const $list = $('#rtWbBtnList').empty();
            draft.forEach((btn, idx) => {
                const label = btn.modalBtn?.trim() || `Button ${idx + 1}`;
                const activeCls = idx === activeIdx ? 'active' : '';
                $list.append(`<a href="#" class="list-group-item list-group-item-action py-2 px-2 fs12 rt-wb-select ${activeCls}" data-idx="${idx}">${escapeHtml(label)}</a>`);
            });

            const cur = draft[activeIdx];
            $('#rtWbEditorTitle').text(`Button #${activeIdx + 1} Settings`);
            $('#rtWbModalBtn').val(cur.modalBtn || '');
            $('#rtWbFooter').val(cur.footer || '');
            $('#rtWbModalText').val(cur.modalText || '');
            $('#rtDeleteWbBtn').prop('disabled', draft.length <= 1);

            const $targets = $('#rtWbTargetsContainer').empty();
            cur.targets.forEach((t, tIdx) => $targets.append(renderTargetCard(t, tIdx)));
        };

        $modal.off('.rtwb');

        $modal.on('click.rtwb', '.rt-wb-select', (e) => {
            e.preventDefault();
            syncEditorToDraft();
            activeIdx = Number($(e.currentTarget).data('idx'));
            renderModal();
        });

        $modal.on('click.rtwb', '#rtAddWbBtn', () => {
            syncEditorToDraft();
            draft.push(createEmptyButton());
            activeIdx = draft.length - 1;
            renderModal();
        });

        $modal.on('click.rtwb', '#rtDeleteWbBtn', () => {
            if (draft.length <= 1) return;
            draft.splice(activeIdx, 1);
            activeIdx = Math.max(0, activeIdx - 1);
            renderModal();
        });

        $modal.on('click.rtwb', '#rtAddTargetBtn', () => {
            syncEditorToDraft();
            draft[activeIdx].targets.push(createEmptyTarget());
            renderModal();
        });

        $modal.on('click.rtwb', '.rt-remove-target', (e) => {
            syncEditorToDraft();
            const tIdx = Number($(e.currentTarget).closest('.rt-target-card').data('target-idx'));
            if (draft[activeIdx].targets.length <= 1) {
                draft[activeIdx].targets[0] = createEmptyTarget();
            } else {
                draft[activeIdx].targets.splice(tIdx, 1);
            }
            renderModal();
        });

        $modal.on('change.rtwb', '.rt-t-fieldtype', (e) => {
            const $card = $(e.currentTarget).closest('.rt-target-card');
            const isMap = $(e.currentTarget).val() === 'map';
            $card.find('.rt-t-fieldname-wrap').toggle(!isMap);
            $card.find('.rt-t-fieldmap-wrap').toggle(isMap);
        });

        $modal.on('change.rtwb', '.rt-t-writetype', (e) => {
            const $card = $(e.currentTarget).closest('.rt-target-card');
            $card.find('.rt-t-writestatic-wrap').toggle($(e.currentTarget).val() === 'static');
        });

        $modal.on('input.rtwb', '#rtWbModalBtn', (e) => {
            const val = $(e.currentTarget).val().trim() || `Button ${activeIdx + 1}`;
            $(`#rtWbBtnList .rt-wb-select[data-idx=${activeIdx}]`).text(val);
        });

        $modal.on('click.rtwb', '#rtSaveWbModal', () => {
            syncEditorToDraft();
            modalSettings = draft;
            $modal.modal('hide');
        });

        $modal.on('click.rtwb', '#rtCancelWbModal, [data-dismiss="modal"], [data-bs-dismiss="modal"]', () => {
            $modal.modal('hide');
        });

        renderModal();
        $modal.modal('show');
    };

    // Load templates
    $.each($("template[id=ReportTweaks]").prop('content').children, (_, el) =>
        html[$(el).prop('id')] = $(el).prop('outerHTML'));

    // Insert settings box on Edit Report page
    let reportOpt = $("div[id=how_to_filters_link]").closest('tr').prevAll().eq(2);
    reportOpt.next().after(reportOpt.prev().nextAll(':lt(2)').addBack().clone().addClass('reportTweaks'));

    $(".reportTweaks div").first().html(html.rtTitle);
    $(".reportTweaks").last().find('div').remove();
    $(".reportTweaks td").last().append(html.rtDashboard);

    $(".reportTweaks [name=tweaks_dateRange]").parent().append(html.rtDateRangeField);
    let dropdown = $("#rtDateRangeField");
    module.fields.forEach((el) => dropdown.append(new Option(el, el)));

    loadSettings();
    if (module.getUrlParameter('report_id')) {
        $("#openWriteBackModal").on('click', openModal);
        $("#save-report-btn").on('click', saveSettings);
    } else {
        $("[name^=tweaks_]").prop('disabled', true);
    }
});
