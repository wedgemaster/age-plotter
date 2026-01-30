// Shared token definitions for Cypher syntax highlighting and completions

const CypherTokens = {
    // Cypher keywords
    keywords: [
        'MATCH', 'OPTIONAL', 'WHERE', 'RETURN', 'WITH', 'ORDER', 'BY',
        'SKIP', 'LIMIT', 'CREATE', 'DELETE', 'DETACH', 'SET', 'REMOVE',
        'MERGE', 'ON', 'CALL', 'YIELD', 'UNWIND', 'AS', 'UNION', 'ALL',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'NOT', 'XOR',
        'IN', 'STARTS', 'ENDS', 'CONTAINS', 'IS', 'NULL', 'TRUE', 'FALSE',
        'COUNT', 'COLLECT', 'EXISTS', 'DISTINCT', 'ASC', 'DESC',
        'FOREACH', 'LOAD', 'CSV', 'FROM', 'HEADERS', 'FIELDTERMINATOR',
    ],

    // Cypher built-in functions
    functions: [
        'count', 'sum', 'avg', 'min', 'max', 'collect',
        'size', 'length', 'type', 'id', 'labels', 'keys', 'properties',
        'head', 'tail', 'last', 'range', 'reverse',
        'toInteger', 'toFloat', 'toString', 'toBoolean',
        'trim', 'ltrim', 'rtrim', 'replace', 'substring', 'split',
        'startsWith', 'endsWith', 'contains',
        'abs', 'ceil', 'floor', 'round', 'sign', 'rand',
        'coalesce', 'nullIf',
    ],

    // SQL keywords (for AGE full SQL mode)
    sqlKeywords: [
        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN',
        'ORDER', 'BY', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'RIGHT',
        'INNER', 'OUTER', 'ON', 'GROUP', 'HAVING', 'DISTINCT',
        'UNION', 'ALL', 'EXCEPT', 'INTERSECT', 'AS',
    ],

    // AGE-specific functions
    ageFunctions: [
        'cypher', 'agtype', 'ag_catalog',
    ],

    // Schema-derived tokens (populated dynamically)
    schema: {
        labels: [],
        relationshipTypes: [],
        propertyKeys: [],
    },

    // Update schema tokens and refresh syntax highlighting
    updateSchema(schema) {
        if (schema) {
            this.schema.labels = schema.labels || [];
            this.schema.relationshipTypes = schema.relationship_types || [];
            this.schema.propertyKeys = schema.property_keys || [];
        } else {
            this.schema.labels = [];
            this.schema.relationshipTypes = [];
            this.schema.propertyKeys = [];
        }

        // Trigger syntax highlighting refresh for both languages
        if (typeof refreshCypherNeo4jHighlighting === 'function') {
            refreshCypherNeo4jHighlighting();
        }
        if (typeof refreshCypherAgeHighlighting === 'function') {
            refreshCypherAgeHighlighting();
        }
    },

    // Get all tokens for tokenizer (keywords + functions + schema)
    getAllKeywords() {
        return [...this.keywords];
    },

    getAllFunctions() {
        return [...this.functions];
    },

    getAllLabels() {
        return [...this.schema.labels];
    },

    getAllRelTypes() {
        return [...this.schema.relationshipTypes];
    },

    getAllProperties() {
        return [...this.schema.propertyKeys];
    },
};

window.CypherTokens = CypherTokens;
