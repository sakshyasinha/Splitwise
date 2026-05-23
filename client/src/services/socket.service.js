import { io } from 'socket.io-client';

let socket = null;

function handleSocketAuthError(error) {
  const code = error?.data?.code;
  const message = String(error?.message || '').toLowerCase();
  const isAuthError =
    code === 'TOKEN_EXPIRED' ||
    code === 'INVALID_TOKEN' ||
    message.includes('token expired') ||
    message.includes('invalid token');

  if (!isAuthError) {
    return;
  }

  socket?.disconnect();
  socket = null;
  window.dispatchEvent(new Event('splitwise:auth-expired'));
}

export function initSocket(token) {
  if (socket) return socket;

  // Prefer explicit Vite env var when provided (for CI / Pages). If not set,
  // we fall back to current origin. However, when the app is hosted on a
  // static site (like GitHub Pages) without a backend, connecting will
  // cause 404s. In that case avoid attempting socket connections.
  const apiOrigin = import.meta.env.VITE_API_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');

  // If running from GitHub Pages (or another static host) and no explicit
  // API origin is configured, skip socket initialization to prevent 404s.
  if (!import.meta.env.VITE_API_ORIGIN && typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    console.warn('Socket initialization skipped: no VITE_API_ORIGIN and running on GitHub Pages');
    return null;
  }

  // Build socket endpoint - keep path consistent with server routes (/messages namespace)
  const socketBase = apiOrigin.replace(/\/$/, '') + '/messages';

  socket = io(socketBase, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect_error', handleSocketAuthError);

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  try {
    socket?.off('connect_error', handleSocketAuthError);
    socket?.disconnect();
  } catch (e) {
    // ignore
  }
  socket = null;
}

export default { initSocket, getSocket, disconnectSocket };
