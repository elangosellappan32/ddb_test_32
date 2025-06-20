/**
 * Handles API errors and formats them for consistent error handling
 * @param {Error} error - The error object from an API call
 * @throws {Error} Formatted error with consistent message structure
 */
export const handleApiError = (error) => {
    console.error('[API Error]:', error);

    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const message = error.response.data?.message || error.response.statusText || error.message;
        const enhancedError = new Error(message);
        enhancedError.status = error.response.status;
        enhancedError.code = error.response.data?.code;
        enhancedError.details = error.response.data;
        throw enhancedError;
    } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response received from server. Please check your connection.');
    } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(error.message || 'An unexpected error occurred');
    }
};
