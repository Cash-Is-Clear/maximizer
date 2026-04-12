// ── Data Source ───────────────────────────────────────────────────────────────
// Set this to the Raw URL of your GitHub Gist containing data.json.
// e.g. 'https://gist.githubusercontent.com/username/GIST_ID/raw/data.json'
const GIST_URL = 'https://gist.githubusercontent.com/Fh-Ndiritu/6522473b9c11d611468f43dbda48225e/raw/2273101b8206f18960d1f8ae51a4c46a11dd3556/data.json';

document.addEventListener('DOMContentLoaded', () => {
    // State
    let strategies = [];
    let filteredStrategies = [];
    let activeFilters = {};
    let activePrimaryFilters = {};
    let activeSearch = '';

    // Primary filters — shown prominently; user must select ≥2 groups to see results
    const primaryFilterConfig = [
        { key: 'Cash Position',        label: 'Cash Position' },
        { key: 'Difficulty',           label: 'Difficulty' },
        { key: 'Time',                 label: 'Time' },
        { key: 'Risk',                 label: 'Risk' },
        { key: 'Who controls strategy?', label: 'Who Controls' },
    ];

    // Sidebar accordion filters
    const filterConfig = [
        {
            group: 'Short Term Benefit', filters: [
                { key: 'Short term benefit', label: 'Short Term Benefit' }
            ]
        },
        {
            group: 'Department & Category', filters: [
                { key: 'Key Department', label: 'Department' },
                { key: 'Category',       label: 'Category' }
            ]
        },
        {
            group: 'Types of Organizations', filters: [
                { key: 'Solo/Micro',    label: 'Solo/Micro' },
                { key: 'Large Co.',     label: 'Large Co.' },
                { key: 'Non-profit',    label: 'Non-profit' },
                { key: 'Every Company?',label: 'Every Company' }
            ]
        },
        {
            group: 'Frequency', filters: [
                { key: 'Frequency', label: 'Frequency' }
            ]
        }
    ];

    // DOM Elements
    const loadingPanel = document.getElementById('loading-panel');
    const errorPanel   = document.getElementById('error-panel');
    const errorMessage = document.getElementById('error-message');
    const retryBtn     = document.getElementById('retry-btn');
    const appContainer = document.getElementById('app-container');
    const filtersContainer = document.getElementById('filters-container');
    const primaryFiltersGrid = document.getElementById('primary-filters-grid');
    const primaryActiveCount = document.getElementById('primary-active-count');
    const strategiesTableContainer = document.getElementById('strategies-table-container');
    const strategiesTbody = document.getElementById('strategies-tbody');
    const totalResults = document.getElementById('total-results');
    const searchInput = document.getElementById('search-input');
    const noResultsState = document.getElementById('no-results-state');
    const sidebarActiveCount = document.getElementById('sidebar-active-count');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const resetPrimaryFiltersBtn = document.getElementById('reset-primary-filters');
    const emptyState = document.getElementById('empty-state');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const sidebarToggleBadge = document.getElementById('sidebar-toggle-badge');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarCloseBtn = document.getElementById('sidebar-close');

    // ── Mobile DOM refs ──────────────────────────────────────────────────
    const mobileSearchToggle  = document.getElementById('mobile-search-toggle');
    const mobileSearchBar     = document.getElementById('mobile-search-bar');
    const mobileSearchInput   = document.getElementById('mobile-search-input');
    const mobileSearchClose   = document.getElementById('mobile-search-close');
    const mobileResultsText   = document.getElementById('mobile-results-text');
    const secondaryFilterBtn  = document.getElementById('secondary-filter-btn');
    const secondaryFilterCount= document.getElementById('secondary-filter-count');
    const primaryFilterDrawer = document.getElementById('primary-filter-drawer');
    const pfdHandleArea       = document.getElementById('pfd-handle-area');
    const pfdSections         = document.getElementById('pfd-sections');
    const pfdActiveCount      = document.getElementById('pfd-active-count');
    const pfdResetBtn         = document.getElementById('pfd-reset-btn');

    // ── Sidebar drawer (tablet + phone secondary filters) ────────────────
    function openSidebar() {
        document.body.classList.add('sidebar-open');
        document.body.style.overflow = 'hidden';
        sidebarToggleBtn.setAttribute('aria-expanded', 'true');
    }
    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
        sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    }
    sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    sidebarToggleBtn.setAttribute('aria-controls', 'sidebar');
    sidebarToggleBtn.addEventListener('click', () => {
        document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
    });
    sidebarOverlay.addEventListener('click', closeSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);

    // On phone the secondary filter button also opens the sidebar
    secondaryFilterBtn.addEventListener('click', () => {
        document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (document.body.classList.contains('sidebar-open')) closeSidebar();
            else if (document.body.classList.contains('search-open')) closeSearch();
        }
    });

    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', e => { if (e.matches) { closeSidebar(); closeSearch(); } });
    window.matchMedia('(min-width: 768px)').addEventListener('change', e => {
        if (e.matches) closeSearch();
    });

    // ── Mobile search (expands under header) ─────────────────────────────
    function openSearch() {
        document.body.classList.add('search-open');
        mobileSearchBar.classList.add('open');
        mobileSearchToggle.classList.add('active');
        mobileSearchToggle.setAttribute('aria-expanded', 'true');
        mobileSearchBar.setAttribute('aria-hidden', 'false');
        mobileSearchInput.focus();
    }
    function closeSearch() {
        document.body.classList.remove('search-open');
        mobileSearchBar.classList.remove('open');
        mobileSearchToggle.classList.remove('active');
        mobileSearchToggle.setAttribute('aria-expanded', 'false');
        mobileSearchBar.setAttribute('aria-hidden', 'true');
        mobileSearchInput.value = '';
        searchInput.value = '';
        activeSearch = '';
        applyFilters();
    }

    // Clear search bar when a bottom-drawer filter is selected
    function clearSearchForFilters() {
        if (!activeSearch && !document.body.classList.contains('search-open')) return;
        document.body.classList.remove('search-open');
        mobileSearchBar.classList.remove('open');
        mobileSearchToggle.classList.remove('active');
        mobileSearchToggle.setAttribute('aria-expanded', 'false');
        mobileSearchBar.setAttribute('aria-hidden', 'true');
        mobileSearchInput.value = '';
        searchInput.value = '';
        activeSearch = '';
    }

    // Clear all filters when search activates (≥5 chars)
    function clearFiltersForSearch() {
        Object.keys(activePrimaryFilters).forEach(key => activePrimaryFilters[key].clear());
        Object.keys(activeFilters).forEach(key => activeFilters[key].clear());
        rebuildPrimaryOptions(0);
        updatePrimaryActiveCount();
        buildFilters();
        buildPrimaryDrawer();
    }

    mobileSearchToggle.addEventListener('click', () => {
        document.body.classList.contains('search-open') ? closeSearch() : openSearch();
    });
    mobileSearchClose.addEventListener('click', closeSearch);
    mobileSearchInput.addEventListener('input', e => {
        const val = e.target.value;
        const newSearch = val.length >= 5 ? val.toLowerCase() : '';
        if (newSearch && newSearch !== activeSearch) clearFiltersForSearch();
        activeSearch = newSearch;
        searchInput.value = val;
        applyFilters();
    });

    // ── Primary filter drawer (bottom, phone) ────────────────────────────
    pfdHandleArea.addEventListener('click', () => {
        primaryFilterDrawer.classList.toggle('open');
    });

    pfdResetBtn.addEventListener('click', e => {
        e.stopPropagation(); // don't toggle drawer
        Object.keys(activePrimaryFilters).forEach(key => activePrimaryFilters[key].clear());
        rebuildPrimaryOptions(0);
        updatePrimaryActiveCount();
        buildFilters();
        applyFilters();
        buildPrimaryDrawer();
    });

    function buildPrimaryDrawer() {
        pfdSections.innerHTML = '';

        primaryFilterConfig.forEach((conf, i) => {
            // Scoped: strategies passing all active selections left of i
            const scoped = strategies.filter(s => {
                for (let j = 0; j < i; j++) {
                    const f = primaryFilterConfig[j];
                    if (activePrimaryFilters[f.key]?.size > 0) {
                        const v = s[f.key] != null ? String(s[f.key]).trim() : '';
                        if (!activePrimaryFilters[f.key].has(v)) return false;
                    }
                }
                return true;
            });

            // Counts from scoped data
            const valuesMap = {};
            scoped.forEach(s => {
                const v = s[conf.key] != null ? String(s[conf.key]).trim() : '';
                if (v) valuesMap[v] = (valuesMap[v] || 0) + 1;
            });

            // All possible values from the full dataset
            const allValues = new Set();
            strategies.forEach(s => {
                const v = s[conf.key] != null ? String(s[conf.key]).trim() : '';
                if (v) allValues.add(v);
            });

            // Skip filter group only if the column has no values at all in the dataset
            if (allValues.size === 0) return;

            const currentVal = activePrimaryFilters[conf.key]?.size > 0
                ? [...activePrimaryFilters[conf.key]][0] : null;

            const section = document.createElement('div');
            section.className = 'pfd-section';

            const header = document.createElement('div');
            header.className = 'pfd-section-header';
            header.innerHTML = `
                <span class="pfd-section-label">${conf.label}</span>
                ${currentVal ? `<span class="pfd-section-value">${currentVal}</span>` : ''}
                <i class="fa-solid fa-chevron-down pfd-section-chevron"></i>
            `;
            header.addEventListener('click', () => {
                const wasExpanded = section.classList.contains('expanded');
                pfdSections.querySelectorAll('.pfd-section.expanded').forEach(s => s.classList.remove('expanded'));
                if (!wasExpanded) section.classList.add('expanded');
            });

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'pfd-options';
            const radioName = 'pfd_' + conf.key.replace(/\W/g, '_');

            [...allValues].sort().forEach(val => {
                const count = valuesMap[val] || 0;
                const lbl = document.createElement('label');
                lbl.className = 'pfd-option' + (count === 0 ? ' pfd-option-zero' : '');

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = radioName;
                radio.value = val;
                radio.disabled = count === 0;
                if (activePrimaryFilters[conf.key]?.has(val)) radio.checked = true;

                radio.addEventListener('click', () => {
                    clearSearchForFilters();
                    const wasSelected = activePrimaryFilters[conf.key].has(val);
                    activePrimaryFilters[conf.key].clear();
                    if (wasSelected) radio.checked = false;
                    else activePrimaryFilters[conf.key].add(val);
                    rebuildPrimaryOptions(i + 1);
                    updatePrimaryActiveCount();
                    buildFilters();
                    applyFilters();
                    buildPrimaryDrawer();
                });

                const labelSpan = document.createElement('span');
                labelSpan.className = 'pfd-option-label';
                labelSpan.textContent = val;

                const countSpan = document.createElement('span');
                countSpan.className = 'pfd-option-count' + (count === 0 ? ' pfd-option-count-zero' : '');
                countSpan.textContent = count;

                lbl.appendChild(radio);
                lbl.appendChild(labelSpan);
                lbl.appendChild(countSpan);
                optionsDiv.appendChild(lbl);
            });

            section.appendChild(header);
            section.appendChild(optionsDiv);
            pfdSections.appendChild(section);
        });

        updatePrimaryDrawerCount();
    }

    function updatePrimaryDrawerCount() {
        const count = primaryFilterConfig.filter(f => activePrimaryFilters[f.key]?.size > 0).length;
        pfdActiveCount.textContent = count;
        pfdActiveCount.classList.toggle('hidden', count === 0);
        pfdResetBtn.classList.toggle('hidden', count === 0);
    }

    function updateSecondaryFilterButton() {
        const primaryCount = primaryFilterConfig.filter(f => activePrimaryFilters[f.key]?.size > 0).length;
        const sidebarCount = Object.values(activeFilters).filter(s => s.size > 0).length;
        // Show when primary filters are active OR search is active (search can use sidebar too)
        secondaryFilterBtn.classList.toggle('hidden', primaryCount === 0 && !activeSearch);
        secondaryFilterCount.textContent = sidebarCount;
        secondaryFilterCount.classList.toggle('hidden', sidebarCount === 0);
    }

    // Sort State
    let currentSortColumn = null;
    let currentSortDirection = 'asc'; // 'asc' or 'desc'

    // ── Gist Fetch ────────────────────────────────────────────────────────────
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

            const data = Array.isArray(parsed)             ? parsed
                       : Array.isArray(parsed.strategies)  ? parsed.strategies
                       : Array.isArray(parsed.data)        ? parsed.data
                       : null;

            if (!data || data.length === 0) {
                throw new Error('Gist returned an empty or unrecognised JSON structure.');
            }

            initApp(data);
        } catch (err) {
            console.error('Gist fetch failed:', err);
            showError(err.message);
        }
    }

    retryBtn.addEventListener('click', loadFromGist);

    loadFromGist();

    // Initialize App
    function initApp(data) {
        strategies = data;
        filteredStrategies = [];

        document.getElementById('total-available').textContent = data.length;

        loadingPanel.classList.add('hidden');
        errorPanel.classList.add('hidden');
        appContainer.classList.remove('hidden');

        buildPrimaryFilters();
        buildFilters();
        applyFilters();
        buildPrimaryDrawer(); // phone bottom drawer
        updateSecondaryFilterButton();
    }

    // Close primary filter dropdowns when clicking outside
    document.addEventListener('click', e => {
        if (!e.target.closest('.pf-group')) {
            document.querySelectorAll('.pf-group.open').forEach(g => g.classList.remove('open'));
        }
    });

    function buildPrimaryFilters() {
        primaryFiltersGrid.innerHTML = '';
        activePrimaryFilters = {};

        // First pass: create the shell (trigger + empty dropdown) for each group
        primaryFilterConfig.forEach((conf, i) => {
            activePrimaryFilters[conf.key] = new Set();

            const groupDiv = document.createElement('div');
            groupDiv.className = 'pf-group';
            groupDiv.dataset.key = conf.key;
            groupDiv.dataset.index = i;

            const trigger = document.createElement('button');
            trigger.className = 'pf-trigger';
            trigger.innerHTML = `<span class="pf-label">${conf.label}</span><span class="pf-badge hidden">0</span><i class="fa-solid fa-chevron-down pf-chevron"></i>`;
            trigger.addEventListener('click', e => {
                e.stopPropagation();
                const isOpen = groupDiv.classList.contains('open');
                document.querySelectorAll('.pf-group.open').forEach(g => g.classList.remove('open'));
                if (!isOpen) groupDiv.classList.add('open');
            });

            const dropdown = document.createElement('div');
            dropdown.className = 'pf-dropdown';

            groupDiv.appendChild(trigger);
            groupDiv.appendChild(dropdown);
            primaryFiltersGrid.appendChild(groupDiv);
        });

        // Second pass: populate options with cascading counts from the start
        rebuildPrimaryOptions(0);
        updatePrimaryActiveCount();
    }

    // Rebuild option counts for all filters at fromIndex and to the right.
    // Each filter's counts reflect only strategies that match all active
    // selections in filters to its left (left-to-right cascade).
    // All values from the full dataset are shown; zero-count options are disabled.
    function rebuildPrimaryOptions(fromIndex) {
        primaryFilterConfig.forEach((conf, i) => {
            if (i < fromIndex) return;

            // Scoped: strategies passing all active selections left of i
            const scoped = strategies.filter(s => {
                for (let j = 0; j < i; j++) {
                    const f = primaryFilterConfig[j];
                    if (activePrimaryFilters[f.key]?.size > 0) {
                        const v = s[f.key] != null ? String(s[f.key]).trim() : '';
                        if (!activePrimaryFilters[f.key].has(v)) return false;
                    }
                }
                return true;
            });

            // Counts from scoped data
            const valuesMap = {};
            scoped.forEach(s => {
                const v = s[conf.key] != null ? String(s[conf.key]).trim() : '';
                if (v) valuesMap[v] = (valuesMap[v] || 0) + 1;
            });

            // All possible values from the full dataset
            const allValues = new Set();
            strategies.forEach(s => {
                const v = s[conf.key] != null ? String(s[conf.key]).trim() : '';
                if (v) allValues.add(v);
            });

            const groupDiv = primaryFiltersGrid.querySelector(`.pf-group[data-key="${CSS.escape(conf.key)}"]`);
            if (!groupDiv) return;

            // Auto-clear selection if its count dropped to zero
            if (activePrimaryFilters[conf.key]?.size > 0) {
                const current = [...activePrimaryFilters[conf.key]][0];
                if (!valuesMap[current]) {
                    activePrimaryFilters[conf.key].clear();
                    groupDiv.classList.remove('has-selection');
                    const checked = groupDiv.querySelector('input[type="radio"]:checked');
                    if (checked) checked.checked = false;
                }
            }

            const dropdown = groupDiv.querySelector('.pf-dropdown');
            dropdown.innerHTML = '';

            const radioName = 'pf_' + conf.key.replace(/\W/g, '_');
            [...allValues].sort().forEach(val => {
                const count = valuesMap[val] || 0;
                const label = document.createElement('label');
                label.className = 'filter-radio' + (count === 0 ? ' filter-radio-zero' : '');

                const cb = document.createElement('input');
                cb.type = 'radio';
                cb.name = radioName;
                cb.value = val;
                cb.disabled = count === 0;
                if (activePrimaryFilters[conf.key]?.has(val)) cb.checked = true;

                cb.addEventListener('click', () => {
                    const wasSelected = activePrimaryFilters[conf.key].has(val);
                    activePrimaryFilters[conf.key].clear();
                    if (wasSelected) {
                        cb.checked = false;
                    } else {
                        activePrimaryFilters[conf.key].add(val);
                    }
                    // Cascade: rebuild counts for all filters to the right
                    rebuildPrimaryOptions(i + 1);
                    updatePrimaryActiveCount();
                    buildFilters();
                    applyFilters();
                });

                label.appendChild(cb);
                label.appendChild(document.createTextNode(val));

                const badge = document.createElement('span');
                badge.className = 'filter-count' + (count === 0 ? ' filter-count-zero' : '');
                badge.textContent = count;
                label.appendChild(badge);

                dropdown.appendChild(label);
            });
        });
    }

    function updatePrimaryActiveCount() {
        const count = primaryFilterConfig.filter(f => activePrimaryFilters[f.key]?.size > 0).length;
        primaryActiveCount.textContent = `${count} of ${primaryFilterConfig.length} active filters`;
        primaryActiveCount.className = 'primary-active-badge' + (count >= 2 ? ' ready' : '');

        primaryFilterConfig.forEach(f => {
            const groupDiv = primaryFiltersGrid.querySelector(`.pf-group[data-key="${CSS.escape(f.key)}"]`);
            if (!groupDiv) return;
            const selCount = activePrimaryFilters[f.key]?.size || 0;
            groupDiv.classList.toggle('has-selection', selCount > 0);
            const badge = groupDiv.querySelector('.pf-badge');
            if (badge) {
                badge.textContent = selCount;
                badge.classList.toggle('hidden', selCount === 0);
            }
        });
        updatePrimaryDrawerCount();
        updateSecondaryFilterButton();
    }

    // Build Filters UI - scoped to the currently selected Dept + Difficulty
    function buildFilters() {
        // Save currently checked values before rebuilding
        const savedSelections = {};
        Object.keys(activeFilters).forEach(key => {
            if (activeFilters[key].size > 0) {
                savedSelections[key] = new Set(activeFilters[key]);
            }
        });

        filtersContainer.innerHTML = '';
        activeFilters = {};

        // Scope sidebar counts to strategies matching current primary filter selections
        const scopedStrategies = strategies.filter(s => {
            for (const f of primaryFilterConfig) {
                if (activePrimaryFilters[f.key]?.size > 0) {
                    const val = s[f.key] != null ? String(s[f.key]).trim() : '';
                    if (!activePrimaryFilters[f.key].has(val)) return false;
                }
            }
            return true;
        });

        filterConfig.forEach(groupConf => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'filter-accordion';

            const groupHeader = document.createElement('div');
            groupHeader.className = 'filter-accordion-header';
            groupHeader.innerHTML = `<span>${groupConf.group}</span> <i class="fa-solid fa-chevron-down"></i>`;

            const groupBody = document.createElement('div');
            groupBody.className = 'filter-accordion-body';

            groupHeader.addEventListener('click', () => {
                groupDiv.classList.toggle('expanded');
                const i = groupHeader.querySelector('i');
                if (groupDiv.classList.contains('expanded')) {
                    i.classList.replace('fa-chevron-down', 'fa-chevron-up');
                } else {
                    i.classList.replace('fa-chevron-up', 'fa-chevron-down');
                }
            });

            groupDiv.appendChild(groupHeader);

            groupConf.filters.forEach(conf => {
                const valuesMap = {};
                scopedStrategies.forEach(s => {
                    let val = s[conf.key];
                    if (val !== undefined && val !== null) {
                        val = String(val).trim();
                        if (val !== '') {
                            valuesMap[val] = (valuesMap[val] || 0) + 1;
                        }
                    }
                });

                const uniqueValues = Object.keys(valuesMap).sort();
                if (uniqueValues.length === 0) return;

                activeFilters[conf.key] = savedSelections[conf.key] || new Set();

                const innerGroup = document.createElement('div');
                innerGroup.className = 'filter-group';

                if (groupConf.filters.length > 1) {
                    const title = document.createElement('div');
                    title.className = 'filter-title';
                    title.textContent = conf.label;
                    innerGroup.appendChild(title);
                }

                const optionsDiv = document.createElement('div');
                optionsDiv.className = 'filter-options';

                const radioName = 'sf_' + conf.key.replace(/\W/g, '_');
                uniqueValues.forEach(val => {
                    const label = document.createElement('label');
                    label.className = 'filter-radio';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'radio';
                    checkbox.name = radioName;
                    checkbox.value = val;
                    if (activeFilters[conf.key].has(val)) {
                        checkbox.checked = true;
                    }
                    checkbox.addEventListener('click', () => {
                        const wasSelected = activeFilters[conf.key].has(val);
                        activeFilters[conf.key].clear();
                        if (wasSelected) {
                            checkbox.checked = false;
                        } else {
                            activeFilters[conf.key].add(val);
                        }
                        applyFilters();
                    });

                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(val));

                    const countBadge = document.createElement('span');
                    countBadge.className = 'filter-count';
                    countBadge.textContent = valuesMap[val];
                    label.appendChild(countBadge);

                    optionsDiv.appendChild(label);
                });

                innerGroup.appendChild(optionsDiv);
                groupBody.appendChild(innerGroup);
            });

            groupDiv.appendChild(groupBody);
            filtersContainer.appendChild(groupDiv);
        });
    }

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const newSearch = val.length >= 5 ? val.toLowerCase() : '';
        if (newSearch && newSearch !== activeSearch) clearFiltersForSearch();
        activeSearch = newSearch;
        applyFilters();
    });

    resetPrimaryFiltersBtn.addEventListener('click', () => {
        document.querySelectorAll('.pf-group input[type="radio"]').forEach(cb => cb.checked = false);
        Object.keys(activePrimaryFilters).forEach(key => activePrimaryFilters[key].clear());
        rebuildPrimaryOptions(0);
        updatePrimaryActiveCount();
        buildFilters();
        applyFilters();
    });

    resetFiltersBtn.addEventListener('click', () => {
        activeSearch = '';
        searchInput.value = '';
        document.querySelectorAll('.filter-radio input[type="radio"]').forEach(cb => cb.checked = false);
        Object.keys(activeFilters).forEach(key => activeFilters[key].clear());
        currentSortColumn = null;
        currentSortDirection = 'asc';
        updateSortIcons();
        updateSidebarActiveCount();
        applyFilters();
    });

    function applyFilters() {
        const activePrimaryGroupCount = primaryFilterConfig.filter(f => activePrimaryFilters[f.key]?.size > 0).length;

        if (!activeSearch && activePrimaryGroupCount < 2) {
            filteredStrategies = [];
            strategiesTbody.innerHTML = '';
            totalResults.textContent = '0';
            mobileResultsText.textContent = activePrimaryGroupCount === 1
                ? 'Select one more filter to see results'
                : 'Select filters below to get started';
            strategiesTableContainer.classList.add('hidden');
            document.getElementById('card-list-container').classList.add('hidden');
            noResultsState.classList.add('hidden');
            emptyState.classList.remove('hidden');
            updateSecondaryFilterButton();
            return;
        }

        filteredStrategies = strategies.filter(s => {
            // Search (≥5 chars) bypasses primary filter requirement but sidebar filters still apply
            if (activeSearch) {
                const searchString = JSON.stringify(Object.values(s)).toLowerCase();
                if (!searchString.includes(activeSearch)) return false;
            } else {
                // Enforce primary filters (AND between groups, OR within a group)
                for (const f of primaryFilterConfig) {
                    if (activePrimaryFilters[f.key]?.size > 0) {
                        const rowVal = s[f.key] != null ? String(s[f.key]).trim() : '';
                        if (!activePrimaryFilters[f.key].has(rowVal)) return false;
                    }
                }
            }

            // Sidebar filters always apply
            for (const key of Object.keys(activeFilters)) {
                if (activeFilters[key].size > 0) {
                    const rowVal = s[key] != null ? String(s[key]).trim() : '';
                    if (!activeFilters[key].has(rowVal)) return false;
                }
            }
            return true;
        });

        sortStrategies();
        renderStrategies();
        renderSummary();
        updateSidebarActiveCount();
    }

    function updateSidebarActiveCount() {
        const sidebarCount = Object.values(activeFilters).filter(s => s.size > 0).length;
        sidebarActiveCount.textContent = sidebarCount;
        sidebarActiveCount.classList.toggle('hidden', sidebarCount === 0);
        sidebarToggleBadge.textContent = sidebarCount;
        sidebarToggleBadge.classList.toggle('hidden', sidebarCount === 0);
        updateSecondaryFilterButton();
    }

    function renderSummary() {
        const n = filteredStrategies.length;
        totalResults.textContent = n;
        mobileResultsText.textContent = n === 1 ? '1 strategy found' : `${n} strategies found`;
        emptyState.classList.add('hidden');

        const cardContainer = document.getElementById('card-list-container');

        if (n === 0) {
            strategiesTableContainer.classList.add('hidden');
            cardContainer.classList.add('hidden');
            noResultsState.classList.remove('hidden');
        } else {
            noResultsState.classList.add('hidden');
            if (mqPhone.matches) {
                cardContainer.classList.remove('hidden');
                strategiesTableContainer.classList.add('hidden');
            } else {
                strategiesTableContainer.classList.remove('hidden');
                cardContainer.classList.add('hidden');
            }
        }
    }

    // Sorting Logic
    function sortStrategies() {
        if (!currentSortColumn) return;

        filteredStrategies.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            // Handle the '#' column numerically
            if (currentSortColumn === '#') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
                return currentSortDirection === 'asc' ? valA - valB : valB - valA;
            }

            // String sort for everything else
            valA = valA !== undefined && valA !== null ? String(valA).trim().toLowerCase() : '';
            valB = valB !== undefined && valB !== null ? String(valB).trim().toLowerCase() : '';

            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function updateSortIcons() {
        document.querySelectorAll('.sortable').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            th.classList.remove('sort-active');
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

    // Attach header sort click listeners
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (currentSortColumn === column) {
                // Toggle direction
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'asc';
            }
            updateSortIcons();
            sortStrategies();
            renderStrategies();
        });
    });

    // ── M3: Card list for phone ───────────────────────────────────────────
    const mqPhone = window.matchMedia('(max-width: 767px)');

    function renderStrategies() {
        if (mqPhone.matches) { renderCards(); return; }
        renderTable();
    }

    function renderCards() {
        const container = document.getElementById('card-list-container');
        container.innerHTML = '';
        container.classList.remove('hidden');
        document.getElementById('strategies-table-container').classList.add('hidden');

        const list = document.createElement('div');
        list.className = 'card-list';

        // All 5 primary fields as chip candidates
        const chipDefs = [
            { key: 'Cash Position',          label: 'Cash',    cls: v => v.toLowerCase().includes('short') ? 'badge-red' : v.toLowerCase().includes('always') ? 'badge-green' : 'badge-blue' },
            { key: 'Difficulty',             label: 'Effort',  cls: v => v.includes('Easy') ? 'badge-green' : (v.includes('Hard') ? 'badge-red' : 'badge-gray') },
            { key: 'Risk',                   label: 'Risk',    cls: v => v.includes('High') ? 'badge-red' : (v.includes('Low') ? 'badge-green' : 'badge-gray') },
            { key: 'Time',                   label: 'Time',    cls: () => 'badge-gray' },
            { key: 'Who controls strategy?', label: 'Control', cls: () => 'badge-gray' },
        ];

        filteredStrategies.forEach(s => {
            const card = document.createElement('div');
            card.className = 'strategy-card';

            const name = String(s['Strategy'] || '—');
            const dept = String(s['Key Department'] || '');

            // Show 3 chips: skip fields that are already active (user knows the value)
            const chips = chipDefs
                .filter(f => !(activePrimaryFilters[f.key] && activePrimaryFilters[f.key].size > 0))
                .slice(0, 3)
                .map(f => {
                    const val = String(s[f.key] || '');
                    if (!val) return '';
                    return `<span class="status-badge ${f.cls(val)}">${f.label}: ${val}</span>`;
                })
                .join('');

            card.innerHTML = `
                <div class="sc-name">${name}</div>
                ${dept ? `<div class="sc-dept">${dept}</div>` : ''}
                <div class="sc-chips">${chips}</div>
                <div class="sc-expand-toggle">
                    <span class="sc-expand-label">More details</span>
                    <i class="fa-solid fa-chevron-down sc-chevron"></i>
                </div>
                <div class="sc-details hidden">
                    ${buildCardDetails(s)}
                </div>
            `;

            card.querySelector('.sc-expand-toggle').addEventListener('click', () => {
                const details = card.querySelector('.sc-details');
                const chevron = card.querySelector('.sc-chevron');
                const label   = card.querySelector('.sc-expand-label');
                const open = details.classList.toggle('hidden');
                chevron.classList.toggle('fa-chevron-down',  open);
                chevron.classList.toggle('fa-chevron-up',   !open);
                label.textContent = open ? 'More details' : 'Less';
            });

            list.appendChild(card);
        });

        container.appendChild(list);
    }

    function buildCardDetails(s) {
        const fields = [
            ['Profit',            s['Profit?']],
            ['Cash Spend',        s['Cash Spend Timing']],
            ['Cash Receipt',      s['Cash Receipt Timing']],
            ['Symptom/Root',      s['Symptom or Root Cause']],
            ['Pillar',            s['Pillar']],
            ['Frequency',         s['Frequency']],
            ['Short Term Benefit',s['Short term benefit']],
            ['Bookkeeping',       s['Find in Bookkeeping?']],
            ['Reports',           s['Find in  Reports']],
            ['Mentor',            s['Mentor']],
        ];
        return fields
            .filter(([, v]) => v !== undefined && String(v).trim() !== '')
            .map(([k, v]) => `
                <div class="sc-detail-row">
                    <span class="sc-detail-label">${k}</span>
                    <span class="sc-detail-value">${v}</span>
                </div>`)
            .join('');
    }

    function renderTable() {
        document.getElementById('card-list-container').classList.add('hidden');
        strategiesTbody.innerHTML = '';

        filteredStrategies.forEach(s => {
            const tr = document.createElement('tr');

            const num           = s['#'] || '-';
            const strategyStr   = String(s['Strategy'] || '-');
            const cashPos       = String(s['Cash Position'] || '-');
            const whoControls   = String(s['Who controls strategy?'] || '-');
            const duration      = String(s['Time'] || '-');
            const prof          = String(s['Profit?'] || '-');
            const spendTiming   = String(s['Cash Spend Timing'] || '-');
            const receiptTiming = String(s['Cash Receipt Timing'] || '-');
            const mentor        = String(s['Mentor'] || '-');
            const sxRoot        = String(s['Symptom or Root Cause'] || '-');
            const pillar        = String(s['Pillar'] || '-');
            const frequency     = String(s['Frequency'] || '-');
            const shortTerm     = String(s['Short term benefit'] || '-');
            const books         = String(s['Find in Bookkeeping?'] || '-');
            const reports       = String(s['Find in  Reports'] || '-');
            const risk          = String(s['Risk'] || '-');

            const riskClass    = risk.includes('High') ? 'badge-red' : (risk.includes('Low') ? 'badge-green' : 'badge-gray');
            const cashPosClass = cashPos.toLowerCase().includes('short') ? 'badge-red' : (cashPos.toLowerCase().includes('always') ? 'badge-green' : 'badge-blue');
            const profClass    = prof.toLowerCase().includes('increase') ? 'badge-green' : (prof.toLowerCase().includes('decrease') ? 'badge-red' : 'badge-gray');

            tr.innerHTML = `
                <td class="sticky-col width-narrow text-muted" data-label="#">${num}</td>
                <td class="sticky-col sticky-col-2 width-wide strategy-title-cell" data-label="Strategy">${strategyStr}</td>
                <td data-label="Cash Position"><span class="status-badge ${cashPosClass}">${cashPos}</span></td>
                <td data-label="Who Controls">${whoControls}</td>
                <td data-label="Time">${duration}</td>
                <td data-label="Profit"><span class="status-badge ${profClass}">${prof}</span></td>
                <td data-label="Cash Spend Timing">${spendTiming}</td>
                <td data-label="Cash Receipt Timing">${receiptTiming}</td>
                <td data-label="Risk"><span class="status-badge ${riskClass}">${risk}</span></td>
                <td data-label="Mentor">${mentor}</td>
                <td data-label="Symptom/Root">${sxRoot}</td>
                <td data-label="Pillar">${pillar}</td>
                <td data-label="Frequency">${frequency}</td>
                <td data-label="Short Term">${shortTerm}</td>
                <td data-label="Bookkeeping">${books}</td>
                <td data-label="Reports">${reports}</td>
            `;
            strategiesTbody.appendChild(tr);
        });
    }
});
