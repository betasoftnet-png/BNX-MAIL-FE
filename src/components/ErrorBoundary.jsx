import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[BNXmail ErrorBoundary]:', error, errorInfo);

    // If it's a chunk loading or network module fetch failure
    const isChunkOrImportError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('dynamically imported');

    if (isChunkOrImportError) {
      const refreshed = sessionStorage.getItem('chunk_load_failed_refreshed');
      if (!refreshed) {
        sessionStorage.setItem('chunk_load_failed_refreshed', 'true');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('chunk_load_failed_refreshed');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-center bg-white dark:bg-gray-900 rounded-xl m-4 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="w-12 h-12 mb-4 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-[#135bec]">
            <span className="material-symbols-outlined text-2xl">refresh</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            New update available
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6">
            A new version of BNXmail has been deployed or the connection was interrupted. Please refresh to continue.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-lg bg-[#135bec] hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
