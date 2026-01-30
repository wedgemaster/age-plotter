// Monaco Editor setup for Cypher queries

let draftUpdateTimeout = null;

/**
 * Cancel any pending draft update.
 * Called when loading from history to prevent overwriting draft.
 */
function cancelDraftUpdate() {
    clearTimeout(draftUpdateTimeout);
    draftUpdateTimeout = null;
}

// Load Monaco from local vendor directory
require.config({
    paths: {
        vs: '/static/vendor/monaco/vs'
    }
});

let editor;
let currentLanguage;
let graphName = '';

require(['vs/editor/editor.main'], function() {
    // Register custom languages before creating editor
    registerCypherNeo4j();
    registerCypherAge();

    // Register completion providers
    if (typeof registerCompletionProviders === 'function') {
        registerCompletionProviders();
    }

    // Get config from data attributes
    const editorContainer = document.getElementById('editor');
    const connectionType = editorContainer.dataset.connectionType;
    graphName = editorContainer.dataset.graphName || 'graph_name';

    // For AGE, default to Cypher-only mode (checkbox is checked by default)
    // For Neo4j, use cypher-neo4j
    currentLanguage = 'cypher-neo4j';

    editor = monaco.editor.create(editorContainer, {
        value: getInitialQuery(connectionType, true),  // true = cypher-only for AGE
        language: currentLanguage,
        theme: 'vs-dark',  // Will be updated by updateMonacoTheme()
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 14,
        tabSize: 2,
    });
    window.monacoEditor = editor;

    // Sync editor content to hidden input on load and change
    document.getElementById('query-input').value = editor.getValue();

    editor.onDidChangeModelContent(() => {
        document.getElementById('query-input').value = editor.getValue();
        autoResizeEditor();

        // Debounced draft update (skip if loading from history)
        clearTimeout(draftUpdateTimeout);
        if (!window.isLoadingFromHistory) {
            draftUpdateTimeout = setTimeout(() => {
                if (typeof updateDraft === 'function') {
                    updateDraft(editor.getValue());
                }
            }, 500);  // 500ms debounce
        }
    });

    // Initial resize
    autoResizeEditor();

    // Ctrl+Enter to run query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        document.getElementById('run-btn').click();
    });

    // Create schema popover UI
    if (typeof createSchemaPopover === 'function') {
        createSchemaPopover();
    }

    // Pre-fetch schema for faster first completion
    if (typeof SchemaCache !== 'undefined') {
        SchemaCache.fetch();
    }

    // Apply DaisyUI-matched Monaco theme
    if (typeof updateMonacoTheme === 'function') {
        updateMonacoTheme();
    }
});

const MIN_EDITOR_LINES = 5;
const MAX_EDITOR_HEIGHT = 400;
const LINE_HEIGHT = 20;

function autoResizeEditor() {
    if (!editor) return;
    const lineCount = editor.getModel().getLineCount();
    const contentHeight = Math.max(lineCount, MIN_EDITOR_LINES) * LINE_HEIGHT;
    const newHeight = Math.min(contentHeight, MAX_EDITOR_HEIGHT);
    const container = document.getElementById('editor');
    container.style.height = newHeight + 'px';
    editor.layout();
}

const DEFAULT_CYPHER = 'MATCH (n)-[r]-(o) RETURN n,r,o LIMIT 50';

function getInitialQuery(connectionType, cypherOnly) {
    if (connectionType === 'age' && !cypherOnly) {
        return `SELECT * FROM cypher('${graphName}', $$
  ${DEFAULT_CYPHER}
$$) AS (n agtype, r agtype, o agtype);`;
    }
    return DEFAULT_CYPHER;
}

// Called when AGE mode toggle changes
function switchAgeMode(cypherOnly) {
    if (!editor) return;

    const currentContent = editor.getValue().trim();

    if (cypherOnly) {
        // Switch to cypher-only mode
        monaco.editor.setModelLanguage(editor.getModel(), 'cypher-neo4j');

        // If current content looks like the default SQL wrapper, replace with Cypher
        if (currentContent.includes("cypher('" + graphName + "'")) {
            editor.setValue(DEFAULT_CYPHER);
        }
    } else {
        // Switch to full SQL mode
        monaco.editor.setModelLanguage(editor.getModel(), 'cypher-age');

        // If current content is plain Cypher, wrap it in SQL
        if (!currentContent.toLowerCase().startsWith('select')) {
            const cypher = currentContent || DEFAULT_CYPHER;
            editor.setValue(`SELECT * FROM cypher('${graphName}', $$
  ${cypher}
$$) AS (n agtype, r agtype, o agtype);`);
        }
    }
}
