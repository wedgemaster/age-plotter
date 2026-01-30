// Monaco completion providers for Cypher and SQL/Cypher
// Uses shared CypherTokens for keywords/functions/schema

function detectContext(model, position) {
    /**
     * Detect completion context from cursor position.
     * Returns: { type: 'label' | 'reltype' | 'property' | 'keyword', partial?: string, variable?: string }
     */
    const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
    });

    // Check for label context: (n: or (:
    const labelMatch = textUntilPosition.match(/\(\s*\w*\s*:\s*(\w*)$/);
    if (labelMatch) {
        return { type: 'label', partial: labelMatch[1] || '' };
    }

    // Check for relationship type context: [r: or [:
    const relMatch = textUntilPosition.match(/\[\s*\w*\s*:\s*(\w*)$/);
    if (relMatch) {
        return { type: 'reltype', partial: relMatch[1] || '' };
    }

    // Check for property context: variable.
    const propMatch = textUntilPosition.match(/\b(\w+)\.\s*(\w*)$/);
    if (propMatch) {
        return { type: 'property', variable: propMatch[1], partial: propMatch[2] || '' };
    }

    // Default to keyword context
    const wordMatch = textUntilPosition.match(/\b(\w*)$/);
    return { type: 'keyword', partial: wordMatch ? wordMatch[1] : '' };
}


function createCompletionItems(items, kind, range) {
    return items.map(item => ({
        label: item,
        kind: kind,
        insertText: item,
        range: range,
    }));
}


async function provideCypherCompletions(model, position) {
    const tokens = window.CypherTokens;
    const context = detectContext(model, position);
    const schema = await SchemaCache.fetch();

    const word = model.getWordUntilPosition(position);
    const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
    };

    const suggestions = [];

    switch (context.type) {
        case 'label':
            if (schema?.labels) {
                suggestions.push(...createCompletionItems(
                    schema.labels,
                    monaco.languages.CompletionItemKind.Class,
                    range
                ));
            }
            break;

        case 'reltype':
            if (schema?.relationship_types) {
                suggestions.push(...createCompletionItems(
                    schema.relationship_types,
                    monaco.languages.CompletionItemKind.Interface,
                    range
                ));
            }
            break;

        case 'property':
            if (schema?.property_keys) {
                suggestions.push(...createCompletionItems(
                    schema.property_keys,
                    monaco.languages.CompletionItemKind.Property,
                    range
                ));
            }
            break;

        case 'keyword':
        default:
            if (tokens) {
                suggestions.push(...createCompletionItems(
                    tokens.keywords,
                    monaco.languages.CompletionItemKind.Keyword,
                    range
                ));
                suggestions.push(...createCompletionItems(
                    tokens.functions,
                    monaco.languages.CompletionItemKind.Function,
                    range
                ));
            }
            break;
    }

    return { suggestions };
}


async function provideSqlAgeCompletions(model, position) {
    const tokens = window.CypherTokens;
    const context = detectContext(model, position);
    const schema = await SchemaCache.fetch();

    const word = model.getWordUntilPosition(position);
    const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
    };

    // Check if we're inside $$ ... $$ (Cypher block)
    const fullText = model.getValue();
    const offset = model.getOffsetAt(position);
    const beforeCursor = fullText.substring(0, offset);

    const inCypherBlock = (beforeCursor.match(/\$\$/g) || []).length % 2 === 1;

    const suggestions = [];

    if (inCypherBlock) {
        // Inside Cypher block - provide Cypher completions
        switch (context.type) {
            case 'label':
                if (schema?.labels) {
                    suggestions.push(...createCompletionItems(
                        schema.labels,
                        monaco.languages.CompletionItemKind.Class,
                        range
                    ));
                }
                break;
            case 'reltype':
                if (schema?.relationship_types) {
                    suggestions.push(...createCompletionItems(
                        schema.relationship_types,
                        monaco.languages.CompletionItemKind.Interface,
                        range
                    ));
                }
                break;
            case 'property':
                if (schema?.property_keys) {
                    suggestions.push(...createCompletionItems(
                        schema.property_keys,
                        monaco.languages.CompletionItemKind.Property,
                        range
                    ));
                }
                break;
            default:
                if (tokens) {
                    suggestions.push(...createCompletionItems(
                        tokens.keywords,
                        monaco.languages.CompletionItemKind.Keyword,
                        range
                    ));
                    suggestions.push(...createCompletionItems(
                        tokens.functions,
                        monaco.languages.CompletionItemKind.Function,
                        range
                    ));
                }
        }
    } else {
        // Outside Cypher block - provide SQL + AGE completions
        if (tokens) {
            suggestions.push(...createCompletionItems(
                tokens.sqlKeywords,
                monaco.languages.CompletionItemKind.Keyword,
                range
            ));
            suggestions.push(...createCompletionItems(
                tokens.ageFunctions,
                monaco.languages.CompletionItemKind.Function,
                range
            ));
        }
    }

    return { suggestions };
}


function registerCompletionProviders() {
    // Provider for cypher-neo4j language (also used for AGE Cypher-only mode)
    monaco.languages.registerCompletionItemProvider('cypher-neo4j', {
        provideCompletionItems: provideCypherCompletions,
        triggerCharacters: [':', '.'],
    });

    // Provider for cypher-age language (full SQL mode)
    monaco.languages.registerCompletionItemProvider('cypher-age', {
        provideCompletionItems: provideSqlAgeCompletions,
        triggerCharacters: [':', '.'],
    });
}

// Export
window.registerCompletionProviders = registerCompletionProviders;
