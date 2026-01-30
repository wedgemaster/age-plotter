/**
 * Query history management and result display.
 *
 * History stores only query text and metadata (not results) to avoid
 * localStorage quota issues. Users can re-run queries to see results.
 */

const MAX_HISTORY = 50;

let history = [];
let selectedIndex = -1;
let draftEntry = null;        // The current draft
window.isLoadingFromHistory = false;  // Flag to prevent draft overwrite during history load

/**
 * Get connection-specific storage key.
 */
function getStorageKey() {
    const name = window.connectionConfig?.name || 'default';
    const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    return `age_plotter_history_${sanitized}`;
}

/**
 * Update draft with current editor content.
 * Called on editor content change (debounced).
 */
function updateDraft(query) {
    if (window.isLoadingFromHistory) return;  // Skip if loading from history
    if (!query.trim()) {
        // Clear draft if editor is empty
        draftEntry = null;
    } else {
        draftEntry = {
            query: query,
            timestamp: Date.now(),
            isDraft: true
        };
    }
    saveDraft();
    renderHistoryDropdown();
}

/**
 * Save draft to localStorage.
 */
function saveDraft() {
    const key = getStorageKey() + '_draft';
    if (draftEntry) {
        localStorage.setItem(key, JSON.stringify(draftEntry));
    } else {
        localStorage.removeItem(key);
    }
}

/**
 * Load draft from localStorage.
 */
function loadDraft() {
    const key = getStorageKey() + '_draft';
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            draftEntry = JSON.parse(stored);
        }
    } catch (e) {
        draftEntry = null;
    }
}

/**
 * Load history from localStorage on page init.
 */
function loadHistory() {
    try {
        const key = getStorageKey();
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Migrate old entries that stored resultHtml
            const needsMigration = parsed.some(e => e.resultHtml);
            history = parsed.map(entry => {
                const { resultHtml, ...rest } = entry;
                return rest;
            });
            // Clear and save migrated data to free space from bloated entries
            if (needsMigration) {
                localStorage.removeItem(key);
                saveHistory();
            }
            renderHistoryDropdown();
        }
    } catch (e) {
        console.warn('Failed to load history:', e);
        history = [];
    }
    loadDraft();
}

/**
 * Save history to localStorage.
 */
function saveHistory() {
    const key = getStorageKey();
    try {
        localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save history:', e);
    }
}

/**
 * Add new entry to history.
 * Only stores query text and metadata, not results.
 */
function addHistoryEntry(query, resultHtml) {
    // Clear draft when query is executed (it becomes a history entry)
    if (draftEntry) {
        draftEntry = null;
        saveDraft();
    }

    // Check if this query already exists (dedupe)
    const existingIndex = history.findIndex(e => e.query === query);
    if (existingIndex !== -1) {
        // Move existing to front
        const [existing] = history.splice(existingIndex, 1);
        existing.timestamp = Date.now();
        history.unshift(existing);
    } else {
        // Create new entry (no resultHtml stored)
        const entry = {
            query: query,
            timestamp: Date.now(),
        };

        // Capture cypher_only mode for AGE connections
        if (window.connectionConfig?.isAge) {
            const checkbox = document.getElementById('cypher-only-mode');
            entry.cypherOnly = checkbox ? !checkbox.checked : true;
        }

        history.unshift(entry);

        // Enforce limit
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }
    }

    saveHistory();
    renderHistoryDropdown();
    selectedIndex = 0;
}

/**
 * Delete history entry by index.
 */
function deleteHistoryEntry(index) {
    if (index < 0 || index >= history.length) return;

    // Don't delete starred entries via single delete
    if (history[index].starred) {
        console.warn('Cannot delete starred entry. Unstar it first.');
        return;
    }

    history.splice(index, 1);
    saveHistory();
    renderHistoryDropdown();

    // Adjust selection
    if (selectedIndex === index) {
        selectedIndex = history.length > 0 ? 0 : -1;
    } else if (selectedIndex > index) {
        selectedIndex--;
    }
}

/**
 * Get first line of query for display.
 */
/**
 * Get query preview for history display.
 * Collapses newlines and whitespace, returns up to 120 chars.
 */
function getQueryPreview(query) {
    const oneLine = query.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    return oneLine.length > 120 ? oneLine.slice(0, 120) + '...' : oneLine;
}

/**
 * Render the history dropdown.
 */
function renderHistoryDropdown() {
    const container = document.getElementById('history-container');
    const dropdown = document.getElementById('history-dropdown');

    if (!dropdown) return;

    const wasHidden = container.classList.contains('hidden');
    const hasDraft = draftEntry && draftEntry.query.trim();

    // Show/hide container based on history and draft
    if (history.length === 0 && !hasDraft) {
        container.classList.add('hidden');
        // Trigger graph resize if visibility changed
        if (!wasHidden) {
            window.dispatchEvent(new Event('resize'));
        }
        return;
    }

    container.classList.remove('hidden');

    // Trigger graph resize if visibility changed
    if (wasHidden) {
        window.dispatchEvent(new Event('resize'));
    }

    // Build options
    const totalCount = history.length + (hasDraft ? 1 : 0);
    let html = `<option value="" disabled>Query History (${totalCount})</option>`;

    // Add draft option at top if exists
    if (hasDraft) {
        const draftLabel = '[Draft] ' + getQueryPreview(draftEntry.query);
        const draftSelected = selectedIndex === -1 ? 'selected' : '';
        html += `<option value="draft" ${draftSelected}>${draftLabel}</option>`;

        // Add separator if there are history entries
        if (history.length > 0) {
            html += `<option disabled>───────────</option>`;
        }
    }

    // Check if we have both starred and non-starred
    const hasStarred = history.some(e => e.starred);
    const hasUnstarred = history.some(e => !e.starred);

    history.forEach((entry, index) => {
        // Add separator before first non-starred item (after starred items)
        if (hasStarred && hasUnstarred && index > 0 &&
            history[index - 1].starred && !entry.starred) {
            html += `<option disabled>───────────</option>`;
        }

        const selected = index === selectedIndex ? 'selected' : '';
        let label = getQueryPreview(entry.query);

        // Add star prefix for starred entries
        if (entry.starred) {
            label = '★ ' + label;
        }

        // Show mode prefix for AGE connections
        if (window.connectionConfig?.isAge && entry.cypherOnly !== undefined) {
            const prefix = entry.cypherOnly ? '[C]' : '[SQL]';
            label = `${prefix} ${label}`;
        }
        html += `<option value="${index}" ${selected}>${label}</option>`;
    });

    dropdown.innerHTML = html;
    updateStarButton();
}

/**
 * Select a history entry (updates dropdown, loads query into editor).
 */
function selectHistoryEntry(indexStr) {
    // Cancel any pending draft update to prevent overwriting draft
    if (typeof cancelDraftUpdate === 'function') {
        cancelDraftUpdate();
    }

    // Handle draft selection
    if (indexStr === 'draft') {
        if (!draftEntry) return;
        window.isLoadingFromHistory = true;
        selectedIndex = -1;  // -1 indicates draft is selected

        // Update dropdown selection
        const dropdown = document.getElementById('history-dropdown');
        if (dropdown) {
            dropdown.value = 'draft';
        }

        // Load draft into editor
        if (window.monacoEditor) {
            window.monacoEditor.setValue(draftEntry.query);
        }
        document.getElementById('query-input').value = draftEntry.query;

        // Reset flag after a short delay (Monaco fires event async)
        setTimeout(() => { window.isLoadingFromHistory = false; }, 50);
        updateStarButton();
        return;
    }

    const index = parseInt(indexStr, 10);
    if (index < 0 || index >= history.length) return;

    window.isLoadingFromHistory = true;  // Set flag before setValue
    selectedIndex = index;
    const entry = history[index];

    // Update dropdown selection
    const dropdown = document.getElementById('history-dropdown');
    if (dropdown) {
        dropdown.value = index;
    }

    // Load query into editor
    restoreEntryMode(entry);
    if (window.monacoEditor) {
        window.monacoEditor.setValue(entry.query);
    }
    document.getElementById('query-input').value = entry.query;

    // Reset flag after a short delay (Monaco fires event async)
    setTimeout(() => { window.isLoadingFromHistory = false; }, 50);
    updateStarButton();
}

/**
 * Restore AGE mode for an entry.
 */
function restoreEntryMode(entry) {
    if (window.connectionConfig?.isAge && entry.cypherOnly !== undefined) {
        const checkbox = document.getElementById('cypher-only-mode');
        const hidden = document.getElementById('cypher-only-hidden');
        if (checkbox && hidden) {
            checkbox.checked = !entry.cypherOnly;
            hidden.value = entry.cypherOnly ? 'true' : '';
            switchAgeMode(entry.cypherOnly);
        }
    }
}

/**
 * Copy selected query to editor (already done by selectHistoryEntry).
 */
function copySelectedToEditor() {
    // Query is already in editor from selection, just focus it
    if (window.monacoEditor) {
        window.monacoEditor.focus();
    }
}

/**
 * Re-run selected query.
 */
function rerunSelected() {
    if (selectedIndex < 0 || selectedIndex >= history.length) return;

    // Query is already in editor from selection, just submit
    document.getElementById('query-form').requestSubmit();
}

/**
 * Delete selected history entry.
 */
function deleteSelected() {
    if (selectedIndex < 0) return;
    deleteHistoryEntry(selectedIndex);
}

/**
 * Clear all history entries.
 */
function clearAllHistory() {
    // Keep only starred entries
    history = history.filter(e => e.starred);
    saveHistory();
    renderHistoryDropdown();
    selectedIndex = history.length > 0 ? 0 : -1;
}

/**
 * Toggle star on selected history entry.
 */
function toggleSelectedStar() {
    if (selectedIndex < 0 || selectedIndex >= history.length) return;

    const currentQuery = history[selectedIndex].query;
    history[selectedIndex].starred = !history[selectedIndex].starred;

    // Re-sort: starred first, then by timestamp (newest first within each group)
    history.sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return b.timestamp - a.timestamp;
    });

    // Update selectedIndex to follow the entry
    selectedIndex = history.findIndex(e => e.query === currentQuery);

    saveHistory();
    renderHistoryDropdown();
}

/**
 * Update star button appearance based on selected entry.
 */
function updateStarButton() {
    const btn = document.getElementById('star-btn');
    if (!btn) return;

    const isStarred = selectedIndex >= 0 && history[selectedIndex]?.starred;
    const svg = btn.querySelector('svg');
    if (svg) {
        svg.setAttribute('fill', isStarred ? 'currentColor' : 'none');
    }
}

/**
 * Set table container height to fill remaining viewport.
 */
function setTableHeight(panel) {
    const tableContainer = panel.querySelector('.table-container');
    if (!tableContainer) return;

    const rect = tableContainer.getBoundingClientRect();
    const availableHeight = window.innerHeight - rect.top - 20;
    const minHeight = 200;
    tableContainer.style.maxHeight = Math.max(availableHeight, minHeight) + 'px';
}

/**
 * Initialize view toggle buttons for a panel.
 */
function initViewToggles(panel) {
    const toggles = panel.querySelectorAll('.view-toggle');
    const tableView = panel.querySelector('.table-view');
    const graphView = panel.querySelector('.graph-view');

    toggles.forEach(btn => {
        btn.onclick = () => {
            // Update button states
            toggles.forEach(b => b.classList.remove('btn-active'));
            btn.classList.add('btn-active');

            // Show/hide views
            const view = btn.dataset.view;
            if (view === 'table') {
                tableView.classList.remove('hidden');
                graphView.classList.add('hidden');
                setTableHeight(panel);
            } else {
                tableView.classList.add('hidden');
                graphView.classList.remove('hidden');
                // Initialize graph if not already done
                initGraphIfNeeded(panel);
            }
        };
    });

    // Auto-switch to table view if not graph compatible (JS fallback)
    const isGraphCompatible = panel.dataset.graphCompatible === 'true';
    if (!isGraphCompatible) {
        const tableBtn = panel.querySelector('.view-toggle[data-view="table"]');
        if (tableBtn && !tableBtn.classList.contains('btn-active')) {
            tableBtn.click();
        }
    } else {
        // Initialize graph only when graph compatible
        initGraphIfNeeded(panel);
    }

    // Add click handlers for table cells
    initTableClickHandlers(panel);

    // Add column resize functionality
    initColumnResize(panel);

    // Add property tooltips on info icon hover
    initPropertyTooltips(panel);
}

/**
 * Initialize click handlers for clickable table cells.
 */
function initTableClickHandlers(panel) {
    panel.querySelectorAll('.clickable-cell').forEach(cell => {
        cell.onclick = () => {
            const type = cell.dataset.type;
            const id = cell.dataset.id;
            const resultPanel = cell.closest('.result-panel');

            if (!resultPanel) return;

            // Parse node/rel data from panel
            const nodes = JSON.parse(resultPanel.dataset.nodes || '[]');
            const rels = JSON.parse(resultPanel.dataset.relationships || '[]');

            let data = null;
            if (type === 'node') {
                data = nodes.find(n => String(n.id) === String(id));
                if (data) {
                    const props = data.properties || {};
                    const displayName = props.name || props.title || props.label || String(data.id).slice(0, 20);
                    showNodeModal({
                        label: displayName,
                        allLabels: data.labels || [data.label],
                        properties: props,
                    });
                }
            } else if (type === 'rel') {
                data = rels.find(r => String(r.id) === String(id));
                if (data) {
                    showRelModal(data);
                }
            }
        };
    });
}

/**
 * Initialize column resize functionality.
 */
function initColumnResize(panel) {
    const table = panel.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('th');
    headers.forEach(th => {
        const handle = th.querySelector('.resize-handle');
        if (!handle) return;

        let startX, startWidth;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.pageX;
            startWidth = th.offsetWidth;
            handle.classList.add('resizing');

            const onMouseMove = (e) => {
                const width = startWidth + (e.pageX - startX);
                th.style.width = Math.max(50, width) + 'px';
            };

            const onMouseUp = () => {
                handle.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                saveColumnWidths(panel);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });

    // Restore saved widths if available
    restoreColumnWidths(panel);
}

/**
 * Save column widths to current history entry.
 */
function saveColumnWidths(panel) {
    if (selectedIndex < 0 || selectedIndex >= history.length) return;

    const widths = {};
    panel.querySelectorAll('th[data-column]').forEach(th => {
        if (th.style.width) {
            widths[th.dataset.column] = th.style.width;
        }
    });

    if (Object.keys(widths).length > 0) {
        history[selectedIndex].columnWidths = widths;
        saveHistory();
    }
}

/**
 * Restore column widths from history entry.
 */
function restoreColumnWidths(panel) {
    if (selectedIndex < 0 || selectedIndex >= history.length) return;

    const entry = history[selectedIndex];
    if (!entry.columnWidths) return;

    panel.querySelectorAll('th[data-column]').forEach(th => {
        const saved = entry.columnWidths[th.dataset.column];
        if (saved) th.style.width = saved;
    });
}

/**
 * Initialize hover tooltips for node/relationship properties.
 */
function initPropertyTooltips(panel) {
    let tooltip = null;
    let hideTimeout = null;

    const nodes = JSON.parse(panel.dataset.nodes || '[]');
    const rels = JSON.parse(panel.dataset.relationships || '[]');

    function hideTooltip() {
        hideTimeout = setTimeout(() => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        }, 100);
    }

    function cancelHide() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    }

    panel.querySelectorAll('.info-icon').forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            cancelHide();

            // Remove existing tooltip
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }

            const cell = icon.closest('.clickable-cell');
            if (!cell) return;

            const type = cell.dataset.type;
            const id = cell.dataset.id;

            let props = null;
            if (type === 'node') {
                const node = nodes.find(n => String(n.id) === String(id));
                props = node?.properties;
            } else if (type === 'rel') {
                const rel = rels.find(r => String(r.id) === String(id));
                props = rel?.properties;
            }

            if (!props || Object.keys(props).length === 0) return;

            tooltip = document.createElement('div');
            tooltip.className = 'property-tooltip';

            const entries = Object.entries(props).slice(0, 8);
            tooltip.innerHTML = entries.map(([k, v]) => {
                const val = String(v).length > 120 ? String(v).slice(0, 120) + '...' : String(v);
                return `<span class="prop-key">${escapeHtmlForTable(k)}:</span><span class="prop-value">${escapeHtmlForTable(val)}</span>`;
            }).join('');

            if (Object.keys(props).length > 8) {
                tooltip.innerHTML += `<span class="prop-key"></span><span class="prop-value">... and ${Object.keys(props).length - 8} more</span>`;
            }

            // Keep tooltip visible when hovering over it
            tooltip.addEventListener('mouseenter', cancelHide);
            tooltip.addEventListener('mouseleave', hideTooltip);

            document.body.appendChild(tooltip);

            // Position near icon
            const rect = icon.getBoundingClientRect();
            tooltip.style.left = Math.min(rect.right + 5, window.innerWidth - tooltip.offsetWidth - 10) + 'px';
            tooltip.style.top = rect.top + 'px';
        });

        icon.addEventListener('mouseleave', hideTooltip);
    });
}

/**
 * Show modal for relationship properties.
 */
function showRelModal(relData) {
    const modal = document.getElementById('node-modal');
    if (!modal) return;

    // Set header
    const labelEl = document.getElementById('modal-node-label');
    if (labelEl) {
        labelEl.textContent = relData.type || 'Relationship';
        labelEl.style.backgroundColor = '#64748b';
    }

    const nameEl = document.getElementById('modal-node-name');
    if (nameEl) {
        nameEl.textContent = `-[:${relData.type}]->`;
    }

    // Build properties table
    const tbody = document.querySelector('#modal-properties-table tbody');
    if (tbody) {
        tbody.innerHTML = '';

        // Add start/end node IDs
        const tr1 = document.createElement('tr');
        tr1.innerHTML = `<td class="font-medium">start_node_id</td><td>${relData.start_node_id}</td>`;
        tbody.appendChild(tr1);

        const tr2 = document.createElement('tr');
        tr2.innerHTML = `<td class="font-medium">end_node_id</td><td>${relData.end_node_id}</td>`;
        tbody.appendChild(tr2);

        // Add other properties
        const props = relData.properties || {};
        for (const [key, value] of Object.entries(props)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-medium">${escapeHtmlForTable(key)}</td>
                <td class="max-w-xs truncate" title="${escapeHtmlForTable(String(value))}">${escapeHtmlForTable(String(value))}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    modal.showModal();
}

/**
 * Escape HTML for table display.
 */
function escapeHtmlForTable(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Handle query result from HTMX.
 */
function handleQueryResult(event) {
    hideCancel();

    if (event.detail.successful) {
        const query = document.getElementById('query-input').value;
        const resultHtml = event.detail.xhr.responseText;

        // Display result
        const results = document.getElementById('results');
        results.innerHTML = resultHtml;

        // Initialize view toggles and graph
        const panel = results.querySelector('.result-panel');
        if (panel) {
            initViewToggles(panel);
        }

        // Add to history (stores query only, not resultHtml)
        addHistoryEntry(query, resultHtml);
    }
}

// Load history on page load
document.addEventListener('DOMContentLoaded', loadHistory);
