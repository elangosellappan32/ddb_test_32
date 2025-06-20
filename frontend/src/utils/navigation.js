let navigationFunction = null;

export const setNavigate = (navigate) => {
  if (typeof navigate === 'function') {
    navigationFunction = navigate;
  } else {
    console.error('Navigation must be a function');
  }
};

export const navigate = (path, options) => {
  if (navigationFunction) {
    navigationFunction(path, options);
  } else {
    console.warn('Navigation function not set - ensure NavigationProvider is mounted');
  }
};

export const goBack = () => {
  if (navigationFunction) {
    navigationFunction(-1);
  } else {
    console.warn('Navigation function not set - ensure NavigationProvider is mounted');
  }
};