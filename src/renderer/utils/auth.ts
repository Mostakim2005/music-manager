/**
 *
 */

export interface LoginInfo {
  isLoggedIn: boolean;
  loginType: 'token' | 'cookie' | 'qr' | 'uid' | null;
  hasToken: boolean;
  hasUser: boolean;
  user: any;
}

/**
 */
export function checkLoginStatus(): LoginInfo {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  const loginType = localStorage.getItem('loginType') as LoginInfo['loginType'];
  const uidLogin = localStorage.getItem('uidLogin');

  const hasToken = !!token;
  const hasUser = !!userData;
  let user = null;

  if (hasUser) {
    try {
      user = JSON.parse(userData);
    } catch (error) {
      console.error('Failed to parse user data:', error);
    }
  }

  let isLoggedIn = false;

  if (loginType === 'uid' || uidLogin === 'true') {
    isLoggedIn = hasUser && !!user;
  } else {
    isLoggedIn = hasToken && hasUser && !!user;
  }

  return {
    isLoggedIn,
    loginType,
    hasToken,
    hasUser,
    user
  };
}

/**
 */
export function hasPermission(requireAuth: boolean = false): boolean {
  const loginInfo = checkLoginStatus();

  if (!loginInfo.isLoggedIn) {
    return false;
  }

  if (requireAuth && loginInfo.loginType === 'uid') {
    return false;
  }

  return true;
}

/**
 */
export function clearLoginStatus(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('loginType');
  localStorage.removeItem('uidLogin');
}

/**
 */
export function setLoginStatus(loginType: LoginInfo['loginType'], token?: string): void {
  localStorage.setItem('loginType', loginType || '');

  if (token) {
    localStorage.setItem('token', token);
  }

  if (loginType === 'uid') {
    localStorage.setItem('uidLogin', 'true');
  }
}

/**
 */
export function getLoginErrorMessage(requireAuth: boolean = false): string {
  const loginInfo = checkLoginStatus();

  if (!loginInfo.isLoggedIn) {
    return 'Please sign in first';
  }

  if (requireAuth && loginInfo.loginType === 'uid') {
    return 'UID login cannot access this feature. Use cookie or QR login.';
  }

  return '';
}
