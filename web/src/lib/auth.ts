const TOKEN_KEY = 'zeroclaw_token';

/**
 * Retrieve the stored authentication token.
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Store an authentication token.
 */
export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage may be unavailable (e.g. in some private browsing modes)
  }
}

/**
 * Remove the stored authentication token.
 */
export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Returns true if a token is currently stored.
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  return token !== null && token.length > 0;
}

/**
 * 从 URL 参数中读取 token 并存储。
 * 用于外部系统跳转时自动传入认证信息。
 */
export function consumeTokenFromURL(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && token.length > 0) {
      setToken(token);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
      return token;
    }
    return null;
  } catch {
    return null;
  }
}
