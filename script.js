/**
 * e-Challan frontend/backend connector.
 * Connects the editable challan webpage to the backend and QR endpoints.
 */

document.addEventListener('DOMContentLoaded', function () {
    const editableFields = document.querySelectorAll('.editable');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const challanPage = document.getElementById('challan-page');
    const serverData = window.__CHALLAN_DATA__ || null;
    let currentChallanNumber = serverData && serverData.challanNumber ? serverData.challanNumber : null;

    editableFields.forEach(function (field) {
        field.addEventListener('focus', function () {
            this.classList.add('editing');
        });

        field.addEventListener('blur', function () {
            this.classList.remove('editing');
            if (this.textContent.trim() === '') {
                this.textContent = '';
            }
        });

        field.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            }
        });

        field.addEventListener('paste', function (e) {
            e.preventDefault();
            var text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    });

    document.addEventListener('click', function (e) {
        if (!e.target.classList.contains('editable')) {
            var activeField = document.querySelector('.editable:focus');
            if (activeField) activeField.blur();
        }
    });

    function collectFields() {
        const fields = {};
        document.querySelectorAll('[data-field]').forEach(function (field) {
            fields[field.dataset.field] = field.textContent.trim();
        });
        return fields;
    }

    function validateFields(fields) {
        const missing = [];
        document.querySelectorAll('[data-field]').forEach(function (field) {
            if (!Object.prototype.hasOwnProperty.call(fields, field.dataset.field)) {
                missing.push(field.dataset.field);
            }
        });
        return missing;
    }

    function setQr(qrDataUrl) {
        if (!qrPlaceholder || !qrDataUrl) return;
        qrPlaceholder.innerHTML = '';
        const img = document.createElement('img');
        img.src = qrDataUrl;
        img.alt = 'QR Code';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.display = 'block';
        qrPlaceholder.appendChild(img);
    }

    function setFieldValues(fields) {
        Object.entries(fields || {}).forEach(function ([key, value]) {
            const field = document.querySelector(`[data-field="${key}"]`);
            if (field) field.textContent = value == null ? '' : String(value);
        });
    }

    function setReadOnly() {
        document.querySelectorAll('[contenteditable="true"]').forEach(function (field) {
            field.setAttribute('contenteditable', 'false');
            field.style.cursor = 'default';
        });
    }

    function createButton(label, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.border = '1px solid #5d4a24';
        button.style.background = '#ffffff';
        button.style.color = '#111111';
        button.style.font = '600 12px Arial, Helvetica, sans-serif';
        button.style.padding = '7px 10px';
        button.style.cursor = 'pointer';
        button.style.borderRadius = '3px';
        button.addEventListener('click', handler);
        return button;
    }

    function createToolbar() {
        if (serverData && serverData.readOnly) return;


        const toolbar = document.createElement('div');
        toolbar.id = 'challan-actions';
        toolbar.style.position = 'fixed';
        toolbar.style.top = '12px';
        toolbar.style.left = '12px';
        toolbar.style.zIndex = '9999';
        toolbar.style.display = 'flex';
        toolbar.style.gap = '8px';
        toolbar.style.alignItems = 'center';
        toolbar.style.background = 'rgba(255,255,255,0.92)';
        toolbar.style.border = '1px solid #b7b7b7';
        toolbar.style.padding = '8px';
        toolbar.style.borderRadius = '4px';
        toolbar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.12)';

        const generateButton = createButton('Generate Challan', generateChallan);
        const qrButton = createButton('Download QR', downloadQr);
        qrButton.dataset.needsChallan = 'true';

        if (!serverData || !serverData.readOnly) toolbar.appendChild(generateButton);
        toolbar.appendChild(qrButton);
        document.body.appendChild(toolbar);
    }

    function updateActionState() {
        document.querySelectorAll('[data-needs-challan="true"]').forEach(function (button) {
            button.disabled = !currentChallanNumber;
            button.style.opacity = currentChallanNumber ? '1' : '0.55';
            button.style.cursor = currentChallanNumber ? 'pointer' : 'not-allowed';
        });
    }

    async function generateChallan() {
        const fields = collectFields();
        const missing = validateFields(fields);
        if (missing.length) {
            alert('Missing fields: ' + missing.join(', '));
            return;
        }

        const response = await fetch('/api/challans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields, browserOrigin: window.location.origin })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Unable to generate challan');
            return;
        }

        currentChallanNumber = data.challanNumber;
        setFieldValues(data.fields);
        setQr(data.qrDataUrl);
        updateActionState();
    }

    function ensureGenerated() {
        if (!currentChallanNumber) {
            alert('Generate the challan first.');
            return false;
        }
        return true;
    }


    function downloadQr() {
        if (!ensureGenerated()) return;
        window.location.href = `/api/challans/${encodeURIComponent(currentChallanNumber)}/qr`;
    }

    if (serverData) {
        currentChallanNumber = serverData.challanNumber;
        setFieldValues(serverData.fields);
        setQr(serverData.qrDataUrl);
        if (serverData.readOnly) setReadOnly();
    }

    createToolbar();
    updateActionState();
});




