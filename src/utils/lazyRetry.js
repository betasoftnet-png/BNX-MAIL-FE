import React from 'react';

/**
 * Enhanced React.lazy with retry mechanism and automatic reload on chunk load failure.
 * Fixes:
 * - "Failed to fetch dynamically imported module" (occurs after new deployments when old chunk hashes are replaced)
 * - "ERR_HTTP2_PING_FAILED" / transient network disconnects
 *
 * @param {Function} componentImport - e.g. () => import('./pages/Casbox')
 * @param {string} [chunkName] - optional identifier for logging
 */
export function lazyRetry(componentImport, chunkName = 'chunk') {
  return React.lazy(async () => {
    const sessionKey = `retry_chunk_refreshed_${chunkName}`;
    const pageHasBeenRefreshed = window.sessionStorage.getItem(sessionKey);

    try {
      return await componentImport();
    } catch (error) {
      console.warn(`[BNXmail] Dynamic import failed for ${chunkName}. Retrying...`, error);

      // 1. Retry once after 1 second (helps recover from transient network/HTTP2 ping drops)
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await componentImport();
      } catch (retryError) {
        console.warn(`[BNXmail] Retry failed for ${chunkName}.`, retryError);

        // 2. If retry failed and page hasn't been auto-reloaded in this session, reload to get latest deployment assets
        if (!pageHasBeenRefreshed) {
          window.sessionStorage.setItem(sessionKey, 'true');
          window.location.reload();
          return new Promise(() => {}); // Suspend until reload occurs
        }

        // Clean up flag after reload was already attempted
        window.sessionStorage.removeItem(sessionKey);
        throw retryError;
      }
    }
  });
}

export default lazyRetry;
