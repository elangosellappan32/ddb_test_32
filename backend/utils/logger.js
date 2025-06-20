const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    debug: (...args) => console.debug('[DEBUG]', ...args),
    logRequest: (req) => {
        console.log(`[REQUEST] ${req.method} ${req.url}`);
    },
    logResponse: (req, res) => {
        console.log(`[RESPONSE] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    },
    logError: (error, req) => {
        console.error(`[ERROR] ${req.method} ${req.url}`, {
            message: error.message,
            stack: error.stack
        });
    },
    // Add a simple timer for performance logging
    startTimer: () => {
        const start = process.hrtime.bigint();
        return {
            end: (label, data) => {
                const end = process.hrtime.bigint();
                const ms = Number(end - start) / 1e6;
                console.log(`[TIMER] ${label} took ${ms.toFixed(2)} ms`, data || '');
            }
        };
    },
};

module.exports = logger;