// Schema cache and fetcher for Monaco completions and syntax highlighting

const SchemaCache = {
    schema: null,
    loading: false,
    lastFetch: null,
    TTL_MS: 5 * 60 * 1000, // 5 minutes

    async fetch(force = false) {
        // Return cached if valid and not forced
        if (!force && this.schema && this.lastFetch) {
            const age = Date.now() - this.lastFetch;
            if (age < this.TTL_MS) {
                return this.schema;
            }
        }

        // Prevent concurrent fetches
        if (this.loading) {
            return new Promise(resolve => {
                const check = setInterval(() => {
                    if (!this.loading) {
                        clearInterval(check);
                        resolve(this.schema);
                    }
                }, 100);
            });
        }

        this.loading = true;
        try {
            const response = await fetch('/schema');
            if (!response.ok) {
                const error = await response.json();
                console.error('Schema fetch failed:', error);
                return null;
            }

            this.schema = await response.json();
            this.lastFetch = Date.now();

            // Update syntax highlighting with new schema
            this._updateSyntaxHighlighting();

            return this.schema;
        } catch (e) {
            console.error('Schema fetch error:', e);
            return null;
        } finally {
            this.loading = false;
        }
    },

    invalidate() {
        this.schema = null;
        this.lastFetch = null;
    },

    _updateSyntaxHighlighting() {
        // Update CypherTokens with schema data
        if (window.CypherTokens && this.schema) {
            window.CypherTokens.updateSchema(this.schema);
        }
    }
};

// Export for use in other modules
window.SchemaCache = SchemaCache;
