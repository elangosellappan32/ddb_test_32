export const handleError = (error) => {
  if (error.response) {
    // Server responded with error
    const message = error.response.data.message || 'An error occurred';
    throw new Error(message);
  } else if (error.request) {
    // Request made but no response
    throw new Error('No response from server');
  } else {
    // Something else went wrong
    throw new Error('Error setting up request');
  }
};