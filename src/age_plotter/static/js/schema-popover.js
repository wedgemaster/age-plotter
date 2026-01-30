// Schema popover button and display

function createSchemaPopover() {
    // Find the toolbar row
    const toolbar = document.querySelector('#query-form .flex.items-center.gap-4.mt-4');
    if (!toolbar) return;

    // Create the schema button container with popover
    const container = document.createElement('div');
    container.className = 'relative';
    container.innerHTML = `
        <button type="button"
                id="schema-btn"
                class="btn btn-ghost btn-sm gap-1"
                onclick="toggleSchemaPopover()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Schema
            <span id="schema-loading" class="loading loading-spinner loading-xs hidden"></span>
        </button>
        <div id="schema-popover"
             class="absolute left-0 top-full mt-2 z-50 hidden bg-base-100 rounded-lg shadow-xl border border-base-300 p-4 min-w-72 max-w-md max-h-96 overflow-auto">
            <div class="flex justify-between items-center mb-3">
                <span class="font-semibold">Graph Schema</span>
                <button type="button"
                        class="btn btn-ghost btn-xs"
                        onclick="reloadSchema()"
                        title="Reload schema">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>
            <div id="schema-content">
                <!-- Populated by JS -->
            </div>
        </div>
    `;

    // Insert at the start of the toolbar (before any toggle or spacer)
    toolbar.prepend(container);

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        const popover = document.getElementById('schema-popover');
        const btn = document.getElementById('schema-btn');
        if (popover && !popover.contains(e.target) && !btn.contains(e.target)) {
            popover.classList.add('hidden');
        }
    });
}


async function toggleSchemaPopover() {
    const popover = document.getElementById('schema-popover');
    const loading = document.getElementById('schema-loading');

    if (!popover.classList.contains('hidden')) {
        popover.classList.add('hidden');
        return;
    }

    // Show popover and load schema
    popover.classList.remove('hidden');
    loading.classList.remove('hidden');

    await renderSchemaContent();

    loading.classList.add('hidden');
}


async function reloadSchema() {
    const loading = document.getElementById('schema-loading');
    loading.classList.remove('hidden');

    SchemaCache.invalidate();
    await renderSchemaContent();

    loading.classList.add('hidden');
}


async function renderSchemaContent() {
    const content = document.getElementById('schema-content');
    const schema = await SchemaCache.fetch(true);

    if (!schema) {
        content.innerHTML = '<p class="text-error text-sm">Failed to load schema</p>';
        return;
    }

    if (schema.error) {
        content.innerHTML = `<p class="text-error text-sm">${schema.error}</p>`;
        return;
    }

    const sections = [];

    // Labels
    if (schema.labels?.length > 0) {
        sections.push(`
            <div class="mb-3">
                <div class="text-sm font-medium text-base-content/70 mb-1">Labels (${schema.labels.length})</div>
                <div class="flex flex-wrap gap-1">
                    ${schema.labels.map(l => `<span class="badge badge-primary badge-sm">${l}</span>`).join('')}
                </div>
            </div>
        `);
    }

    // Relationship types
    if (schema.relationship_types?.length > 0) {
        sections.push(`
            <div class="mb-3">
                <div class="text-sm font-medium text-base-content/70 mb-1">Relationships (${schema.relationship_types.length})</div>
                <div class="flex flex-wrap gap-1">
                    ${schema.relationship_types.map(r => `<span class="badge badge-secondary badge-sm">${r}</span>`).join('')}
                </div>
            </div>
        `);
    }

    // Properties
    if (schema.property_keys?.length > 0) {
        sections.push(`
            <div class="mb-3">
                <div class="text-sm font-medium text-base-content/70 mb-1">Properties (${schema.property_keys.length})</div>
                <div class="flex flex-wrap gap-1">
                    ${schema.property_keys.map(p => `<span class="badge badge-ghost badge-sm">${p}</span>`).join('')}
                </div>
            </div>
        `);
    }

    if (sections.length === 0) {
        content.innerHTML = '<p class="text-sm text-base-content/50">No schema data found</p>';
    } else {
        content.innerHTML = sections.join('');
    }
}


// Export functions
window.toggleSchemaPopover = toggleSchemaPopover;
window.reloadSchema = reloadSchema;
window.createSchemaPopover = createSchemaPopover;
