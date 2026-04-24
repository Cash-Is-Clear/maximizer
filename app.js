const GIST_URL = 'https://gist.githubusercontent.com/Fh-Ndiritu/6522473b9c11d611468f43dbda48225e/raw/2273101b8206f18960d1f8ae51a4c46a11dd3556/data.json';

const MAX_RESULTS = 20;

const FILTER_COLUMNS = [
    { key: 'Cash Position',          label: 'Cash Position' },
    { key: 'Cash Receipt Timing',    label: 'Cash Receipt' },
    { key: 'Cash Spend Timing',      label: 'Cash Spend' },
    { key: 'Category',               label: 'Category' },
    { key: 'Key Department',         label: 'Department' },
    { key: 'Difficulty',             label: 'Difficulty' },
    { key: 'Every Company?',         label: 'Every Company' },
    { key: 'Find in Bookkeeping?',   label: 'Find in Bookkeeping' },
    { key: 'Find in  Reports',       label: 'Find in Reports' },
    { key: 'Frequency',              label: 'Frequency' },
    { key: 'Large Co.',              label: 'Large Co.' },
    { key: 'Mentor',                 label: 'Mentor' },
    { key: 'Non-profit',             label: 'Non-profit' },
    { key: 'Pillar',                 label: 'Pillar' },
    { key: 'Profit?',                label: 'Profit' },
    { key: 'Risk',                   label: 'Risk' },
    { key: 'Short term benefit',     label: 'Short-Term' },
    { key: 'Solo/Micro',             label: 'Solo/Micro' },
    { key: 'Symptom or Root Cause',  label: 'Symptom/Root' },
    { key: 'Time',                   label: 'Time' },
    { key: 'Who controls strategy?', label: 'Who Controls' },
];

document.addEventListener('DOMContentLoaded', () => {
    let strategies = [];
    let activeFilters = {};   // key → Set of selected values
    let activeSearch = '';
    let currentSortColumn = null;
    let currentSortDirection = 'asc';

    // DOM
    const loadingPanel   = document.getElementById('loading-panel');
    const errorPanel     = document.getElementById('error-panel');
    const errorMessage   = document.getElementById('error-message');
    const retryBtn       = document.getElementById('retry-btn');
    const appContainer   = document.getElementById('app-container');
    const filterBar      = document.getElementById('filter-bar');
    const resetFiltersBtn= document.getElementById('reset-filters');
    const limitNotice    = document.getElementById('results-limit-notice');
    const fullMatchCount = document.getElementById('full-match-count');
    const tableContainer = document.getElementById('strategies-table-container');
    const tbody          = document.getElementById('strategies-tbody');
    const totalResults   = document.getElementById('total-results');
    const totalAvailable = document.getElementById('total-available');
    const emptyState     = document.getElementById('empty-state');
    const emptyTotal     = document.getElementById('empty-total');
    const noResults      = document.getElementById('no-results-state');
    const searchInput    = document.getElementById('search-input');

    // ── Loading / error ──────────────────────────────────────────────
    function showLoading() {
        loadingPanel.classList.remove('hidden');
        errorPanel.classList.add('hidden');
        appContainer.classList.add('hidden');
    }
    function showError(msg) {
        loadingPanel.classList.add('hidden');
        errorPanel.classList.remove('hidden');
        appContainer.classList.add('hidden');
        errorMessage.textContent = msg;
    }

    async function loadFromGist() {
        showLoading();
        try {
            const res = await fetch(GIST_URL);
            if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
            const parsed = await res.json();
            const data = Array.isArray(parsed)            ? parsed
                       : Array.isArray(parsed.strategies) ? parsed.strategies
                       : Array.isArray(parsed.data)       ? parsed.data
                       : null;
            if (!data || data.length === 0) throw new Error('Gist returned an empty or unrecognised JSON structure.');
            initApp(data);
        } catch (err) {
            console.error('Gist fetch failed:', err);
            showError(err.message);
        }
    }

    // ── Keep --header-h in sync so the sticky filter bar sits flush below ──
    const appHeader = document.querySelector('.app-header');
    function syncHeaderHeight() {
        document.documentElement.style.setProperty('--header-h', appHeader.offsetHeight + 'px');
    }
    syncHeaderHeight();
    new ResizeObserver(syncHeaderHeight).observe(appHeader);

    retryBtn.addEventListener('click', loadFromGist);
    loadFromGist();

    // ── Init ─────────────────────────────────────────────────────────
    function initApp(data) {
        strategies = data;
        totalAvailable.textContent = data.length;
        emptyTotal.textContent = data.length;

        loadingPanel.classList.add('hidden');
        errorPanel.classList.add('hidden');
        appContainer.classList.remove('hidden');

        FILTER_COLUMNS.forEach(col => { activeFilters[col.key] = new Set(); });

        buildFilterBar();
        applyFilters();
    }

    // ── Filter bar ───────────────────────────────────────────────────
    function buildFilterBar() {
        filterBar.innerHTML = '';

        FILTER_COLUMNS.forEach(col => {
            // Only include columns that have at least one non-empty value in the dataset
            const values = getColumnValues(col.key, strategies);
            if (values.length === 0) return;

            const group = document.createElement('div');
            group.className = 'fb-group';
            group.dataset.key = col.key;

            const trigger = document.createElement('button');
            trigger.className = 'fb-trigger';
            trigger.innerHTML = `<span class="fb-label">${col.label}</span><span class="fb-badge hidden">0</span><i class="fa-solid fa-chevron-down fb-chevron"></i>`;
            trigger.addEventListener('click', e => {
                e.stopPropagation();
                const isOpen = group.classList.contains('open');
                closeAllDropdowns();
                if (!isOpen) {
                    group.classList.add('open');
                    // Position the fixed dropdown relative to the trigger's viewport coords
                    const rect = trigger.getBoundingClientRect();
                    const dropdown = group.querySelector('.fb-dropdown');
                    dropdown.style.top  = (rect.bottom + 6) + 'px';
                    dropdown.style.left = rect.left + 'px';
                }
            });

            const dropdown = document.createElement('div');
            dropdown.className = 'fb-dropdown';
            buildDropdown(dropdown, col.key, values);

            group.appendChild(trigger);
            group.appendChild(dropdown);
            filterBar.appendChild(group);
        });
    }

    function getColumnValues(key, rows) {
        const seen = new Set();
        rows.forEach(s => {
            const v = s[key] != null ? String(s[key]).trim() : '';
            if (v) seen.add(v);
        });
        return [...seen].sort();
    }

    function buildDropdown(dropdown, key, values) {
        dropdown.innerHTML = '';
        values.forEach(val => {
            const label = document.createElement('label');
            label.className = 'fb-option';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = val;
            cb.checked = activeFilters[key]?.has(val) || false;
            cb.addEventListener('change', () => {
                if (cb.checked) activeFilters[key].add(val);
                else            activeFilters[key].delete(val);
                updateTriggerBadge(key);
                applyFilters();
            });

            label.appendChild(cb);
            label.appendChild(document.createTextNode(val));
            dropdown.appendChild(label);
        });
    }

    function updateTriggerBadge(key) {
        const group = filterBar.querySelector(`.fb-group[data-key="${CSS.escape(key)}"]`);
        if (!group) return;
        const count = activeFilters[key]?.size || 0;
        const badge = group.querySelector('.fb-badge');
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
        group.classList.toggle('has-selection', count > 0);
    }

    function closeAllDropdowns() {
        filterBar.querySelectorAll('.fb-group.open').forEach(g => g.classList.remove('open'));
    }

    document.addEventListener('click', e => {
        if (!e.target.closest('.fb-group')) closeAllDropdowns();
    });

    // Close dropdowns on scroll so the fixed-position panel doesn't drift
    window.addEventListener('scroll', closeAllDropdowns, { passive: true });
    document.querySelector('.filter-bar').addEventListener('scroll', closeAllDropdowns, { passive: true });

    // ── Reset ────────────────────────────────────────────────────────
    resetFiltersBtn.addEventListener('click', resetAll);
    document.getElementById('no-results-reset').addEventListener('click', resetAll);

    function resetAll() {
        activeSearch = '';
        searchInput.value = '';
        FILTER_COLUMNS.forEach(col => {
            activeFilters[col.key] = new Set();
            updateTriggerBadge(col.key);
            const group = filterBar.querySelector(`.fb-group[data-key="${CSS.escape(col.key)}"]`);
            if (group) group.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        });
        currentSortColumn = null;
        currentSortDirection = 'asc';
        updateSortIcons();
        applyFilters();
    }

    // ── Search ───────────────────────────────────────────────────────
    searchInput.addEventListener('input', e => {
        activeSearch = e.target.value.length >= 5 ? e.target.value.toLowerCase() : '';
        applyFilters();
    });

    // ── Apply filters ────────────────────────────────────────────────
    function applyFilters() {
        let matched = strategies.filter(s => {
            if (activeSearch) {
                return JSON.stringify(Object.values(s)).toLowerCase().includes(activeSearch);
            }
            for (const col of FILTER_COLUMNS) {
                const sel = activeFilters[col.key];
                if (!sel || sel.size === 0) continue;
                const rowVal = s[col.key] != null ? String(s[col.key]).trim() : '';
                if (!sel.has(rowVal)) return false;
            }
            return true;
        });

        const totalMatched = matched.length;

        // Sort before slicing
        if (currentSortColumn) {
            matched = sortRows(matched);
        }

        const displayed = matched.slice(0, MAX_RESULTS);

        totalResults.textContent = displayed.length;

        if (totalMatched > MAX_RESULTS) {
            fullMatchCount.textContent = totalMatched;
            limitNotice.classList.remove('hidden');
        } else {
            limitNotice.classList.add('hidden');
        }

        if (totalMatched === 0) {
            tableContainer.classList.add('hidden');
            emptyState.classList.add('hidden');
            noResults.classList.remove('hidden');
        } else {
            noResults.classList.add('hidden');
            emptyState.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            renderTable(displayed);
        }
    }

    // ── Sort ─────────────────────────────────────────────────────────
    function sortRows(rows) {
        return [...rows].sort((a, b) => {
            let va = a[currentSortColumn];
            let vb = b[currentSortColumn];
            if (currentSortColumn === '#') {
                va = Number(va) || 0;
                vb = Number(vb) || 0;
                return currentSortDirection === 'asc' ? va - vb : vb - va;
            }
            va = va != null ? String(va).trim().toLowerCase() : '';
            vb = vb != null ? String(vb).trim().toLowerCase() : '';
            if (va < vb) return currentSortDirection === 'asc' ? -1 : 1;
            if (va > vb) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function updateSortIcons() {
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-active');
            const icon = th.querySelector('.sort-icon');
            icon.classList.remove('fa-sort-up', 'fa-sort-down');
            icon.classList.add('fa-sort');
        });
        if (currentSortColumn) {
            const activeTh = document.querySelector(`th[data-sort="${currentSortColumn}"]`);
            if (activeTh) {
                activeTh.classList.add('sort-active');
                const icon = activeTh.querySelector('.sort-icon');
                icon.classList.remove('fa-sort');
                icon.classList.add(currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            }
        }
    }

    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (currentSortColumn === col) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = col;
                currentSortDirection = 'asc';
            }
            updateSortIcons();
            applyFilters();
        });
    });

    // ── Render table ─────────────────────────────────────────────────
    function renderTable(rows) {
        tbody.innerHTML = '';
        rows.forEach(s => {
            const tr = document.createElement('tr');

            const risk      = String(s['Risk']          || '-');
            const cashPos   = String(s['Cash Position'] || '-');
            const prof      = String(s['Profit?']       || '-');
            const diff      = String(s['Difficulty']    || '-');

            const riskClass  = risk.includes('High')                     ? 'badge-red'   : risk.includes('Low')      ? 'badge-green' : 'badge-gray';
            const cashClass  = cashPos.toLowerCase().includes('short')   ? 'badge-red'   : cashPos.toLowerCase().includes('always') ? 'badge-green' : 'badge-blue';
            const profClass  = prof.toLowerCase().includes('increase')   ? 'badge-green' : prof.toLowerCase().includes('decrease')  ? 'badge-red'   : 'badge-gray';
            const diffClass  = diff.toLowerCase().includes('easy')       ? 'badge-green' : diff.toLowerCase().includes('hard')      ? 'badge-red'   : 'badge-gray';

            tr.innerHTML = `
                <td class="sticky-col width-wide strategy-title-cell">${String(s['Strategy']             || '-')}</td>
                <td><span class="status-badge ${cashClass}">${cashPos}</span></td>
                <td>${String(s['Cash Receipt Timing']    || '-')}</td>
                <td>${String(s['Cash Spend Timing']      || '-')}</td>
                <td>${String(s['Category']               || '-')}</td>
                <td>${String(s['Key Department']         || '-')}</td>
                <td><span class="status-badge ${diffClass}">${diff}</span></td>
                <td>${String(s['Every Company?']         || '-')}</td>
                <td>${String(s['Find in Bookkeeping?']   || '-')}</td>
                <td>${String(s['Find in  Reports']       || '-')}</td>
                <td>${String(s['Frequency']              || '-')}</td>
                <td>${String(s['Large Co.']              || '-')}</td>
                <td>${String(s['Mentor']                 || '-')}</td>
                <td>${String(s['Non-profit']             || '-')}</td>
                <td>${String(s['Pillar']                 || '-')}</td>
                <td><span class="status-badge ${profClass}">${prof}</span></td>
                <td><span class="status-badge ${riskClass}">${risk}</span></td>
                <td>${String(s['Short term benefit']     || '-')}</td>
                <td>${String(s['Solo/Micro']             || '-')}</td>
                <td>${String(s['Symptom or Root Cause']  || '-')}</td>
                <td>${String(s['Time']                   || '-')}</td>
                <td>${String(s['Who controls strategy?'] || '-')}</td>
            `;
            tbody.appendChild(tr);
        });
    }
});
