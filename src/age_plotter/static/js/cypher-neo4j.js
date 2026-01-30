// Neo4j Cypher language definition for Monaco Editor

function buildCypherNeo4jTokenizer() {
    // Build tokenizer with current CypherTokens values
    const tokens = window.CypherTokens || { keywords: [], functions: [], schema: { labels: [], relationshipTypes: [], propertyKeys: [] } };

    return {
        ignoreCase: true,
        keywords: tokens.keywords,
        functions: tokens.functions,
        labels: tokens.schema.labels,
        relationshipTypes: tokens.schema.relationshipTypes,
        propertyKeys: tokens.schema.propertyKeys,
        operators: [
            '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '^',
            '=~', '..', '|', '->', '<-',
        ],
        tokenizer: {
            root: [
                // Comments
                [/\/\/.*$/, 'comment'],
                [/\/\*/, 'comment', '@comment'],

                // Strings
                [/"([^"\\]|\\.)*$/, 'string.invalid'],
                [/'([^'\\]|\\.)*$/, 'string.invalid'],
                [/"/, 'string', '@string_double'],
                [/'/, 'string', '@string_single'],

                // Numbers
                [/\d+\.\d*/, 'number.float'],
                [/\d+/, 'number'],

                // Node/relationship patterns
                [/\(/, 'delimiter.parenthesis'],
                [/\)/, 'delimiter.parenthesis'],
                [/\[/, 'delimiter.bracket'],
                [/\]/, 'delimiter.bracket'],
                [/\{/, 'delimiter.brace'],
                [/\}/, 'delimiter.brace'],

                // Labels and types (after colon) - check against schema
                [/:(\w+)/, {
                    cases: {
                        '$1@labels': 'type.label',
                        '$1@relationshipTypes': 'type.relationship',
                        '@default': 'type.identifier',
                    }
                }],

                // Variables and properties
                [/\$\w+/, 'variable'],
                [/\b[a-zA-Z_]\w*(?=\s*\.)/, 'variable'],

                // Property access - check against schema
                [/\.(\w+)/, {
                    cases: {
                        '$1@propertyKeys': 'attribute.known',
                        '@default': 'attribute.name',
                    }
                }],

                // Keywords and functions
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@functions': 'function',
                        '@default': 'identifier',
                    }
                }],

                // Operators
                [/[<>=!+\-*/%^|]/, 'operator'],
                [/->|<-/, 'operator'],
            ],

            comment: [
                [/[^/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[/*]/, 'comment'],
            ],

            string_double: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, 'string', '@pop'],
            ],

            string_single: [
                [/[^\\']+/, 'string'],
                [/\\./, 'string.escape'],
                [/'/, 'string', '@pop'],
            ],
        },
    };
}

function registerCypherNeo4j() {
    monaco.languages.register({ id: 'cypher-neo4j' });
    monaco.languages.setMonarchTokensProvider('cypher-neo4j', buildCypherNeo4jTokenizer());
}

function refreshCypherNeo4jHighlighting() {
    if (typeof monaco !== 'undefined') {
        monaco.languages.setMonarchTokensProvider('cypher-neo4j', buildCypherNeo4jTokenizer());
    }
}

window.refreshCypherNeo4jHighlighting = refreshCypherNeo4jHighlighting;
