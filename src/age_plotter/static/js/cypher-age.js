// PostgreSQL AGE Cypher/SQL language definition for Monaco Editor

function buildCypherAgeTokenizer() {
    // Build tokenizer with current CypherTokens values
    const tokens = window.CypherTokens || {
        keywords: [],
        functions: [],
        sqlKeywords: [],
        ageFunctions: [],
        schema: { labels: [], relationshipTypes: [], propertyKeys: [] }
    };

    return {
        ignoreCase: true,
        sqlKeywords: tokens.sqlKeywords,
        cypherKeywords: tokens.keywords,
        cypherFunctions: tokens.functions,
        ageKeywords: tokens.ageFunctions,
        labels: tokens.schema.labels,
        relationshipTypes: tokens.schema.relationshipTypes,
        propertyKeys: tokens.schema.propertyKeys,

        tokenizer: {
            root: [
                // AGE cypher() function call
                [/\bcypher\b/, 'keyword.age'],
                [/\bagtype\b/, 'type.age'],
                [/\bag_catalog\b/, 'keyword.age'],

                // Dollar-quoted string (contains Cypher)
                [/\$\$/, 'string.cypher', '@cypher_block'],

                // Regular SQL strings
                [/'([^'\\]|\\.)*'/, 'string'],

                // Comments
                [/--.*$/, 'comment'],
                [/\/\*/, 'comment', '@comment'],

                // Numbers
                [/\d+\.\d*/, 'number.float'],
                [/\d+/, 'number'],

                // Keywords
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@sqlKeywords': 'keyword.sql',
                        '@default': 'identifier',
                    }
                }],

                // Operators
                [/[<>=!+\-*/%]/, 'operator'],
                [/::/, 'operator'],
            ],

            cypher_block: [
                [/\$\$/, 'string.cypher', '@pop'],

                // Inside $$ ... $$, highlight as Cypher
                // Labels and types (after colon) - check against schema
                [/:(\w+)/, {
                    cases: {
                        '$1@labels': 'type.label',
                        '$1@relationshipTypes': 'type.relationship',
                        '@default': 'type.identifier',
                    }
                }],

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
                        '@cypherKeywords': 'keyword.cypher',
                        '@cypherFunctions': 'function.cypher',
                        '@default': 'identifier',
                    }
                }],

                [/"([^"\\]|\\.)*"/, 'string'],
                [/'([^'\\]|\\.)*'/, 'string'],
                [/\d+\.\d*/, 'number.float'],
                [/\d+/, 'number'],
                [/[<>=!+\-*/%^|]/, 'operator'],
                [/->|<-/, 'operator'],
                [/./, 'string.cypher'],
            ],

            comment: [
                [/[^/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[/*]/, 'comment'],
            ],
        },
    };
}

function registerCypherAge() {
    monaco.languages.register({ id: 'cypher-age' });
    monaco.languages.setMonarchTokensProvider('cypher-age', buildCypherAgeTokenizer());
}

function refreshCypherAgeHighlighting() {
    if (typeof monaco !== 'undefined') {
        monaco.languages.setMonarchTokensProvider('cypher-age', buildCypherAgeTokenizer());
    }
}

window.refreshCypherAgeHighlighting = refreshCypherAgeHighlighting;
