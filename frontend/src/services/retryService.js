/**
 * A service for handling retries with exponential backoff
 */

const DEFAULT_RETRIES = 3;
const MAX_DELAY = 5000; // Maximum delay of 5 seconds

/**
 * Execute an operation with retries and exponential backoff
 * @param {Function} operation - The async operation to execute
 * @param {Object} options - Retry options
 * @param {number} options.retries - Number of retries (default: 3)
 * @param {Function} options.shouldRetry - Function to determine if retry should be attempted
 * @param {Function} options.onRetry - Function called before each retry attempt
 * @returns {Promise} - Result of the operation
 */
export const withRetry = async (operation, options = {}) => {
    const {
        retries = DEFAULT_RETRIES,
        shouldRetry = () => true,
        onRetry = () => {}
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await operation(attempt);
            return result;
        } catch (error) {
            lastError = error;
            console.error(`Operation failed (attempt ${attempt}/${retries}):`, error);

            // Check if we should retry
            if (!shouldRetry(error) || attempt === retries) {
                break;
            }

            // Notify before retry
            await onRetry(attempt, error);

            // Wait with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), MAX_DELAY);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

/**
 * Default retry conditions
 */
export const defaultShouldRetry = (error) => {
    // Don't retry on these conditions
    if (error.message?.includes('not found') || 
        error.message?.includes('permission') ||
        error.response?.status === 404 ||
        error.response?.status === 403 ||
        error.response?.status === 401) {
        return false;
    }
    return true;
};
