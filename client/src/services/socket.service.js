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

  console.error('🔒 Socket auth error:', error);

  socket?.disconnect();
  socket = null;

  window.dispatchEvent(new Event('splitwise:auth-expired'));
}

export function initSocket(token) {
  if (socket) {
    console.log('⚠️ Reusing existing socket instance');
    return socket;
  }

  // Environment values
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  const derivedApiOrigin = apiBaseUrl
    ? apiBaseUrl.replace(/\/api\/?$/, '')
    : '';

  const apiOrigin =
    import.meta.env.VITE_API_ORIGIN ||
    derivedApiOrigin ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : '');

  if (
    !import.meta.env.VITE_API_ORIGIN &&
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('github.io')
  ) {
    console.warn(
      'Socket initialization skipped: no VITE_API_ORIGIN and running on GitHub Pages'
    );
    return null;
  }

  const socketBase =
    apiOrigin.replace(/\/$/, '') + '/messages';

  // ==========================
  // DEBUG OUTPUT
  // ==========================

  console.group('🚀 SOCKET DEBUG');

  console.log('VITE_API_BASE_URL');
  console.log(import.meta.env.VITE_API_BASE_URL);

  console.log('VITE_API_ORIGIN');
  console.log(import.meta.env.VITE_API_ORIGIN);

  console.log('apiBaseUrl');
  console.log(apiBaseUrl);

  console.log('derivedApiOrigin');
  console.log(derivedApiOrigin);

  console.log('apiOrigin');
  console.log(apiOrigin);

  console.log('socketBase');
  console.log(socketBase);

  console.log('window.location.origin');
  console.log(
    typeof window !== 'undefined'
      ? window.location.origin
      : 'N/A'
  );

  console.groupEnd();

  socket = io(socketBase, {
    auth: {
      token,
    },

    transports: ['websocket', 'polling'],

    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ SOCKET CONNECTED');
    console.log('socket.id =', socket.id);
    console.log('socket.io.uri =', socket.io.uri);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ SOCKET CONNECT ERROR');
    console.error(err);

    try {
      console.log('socket.io.uri =', socket.io.uri);
    } catch (_) {}
  });

  socket.on('disconnect', (reason) => {
    console.warn('⚠️ SOCKET DISCONNECTED');
    console.warn('Reason:', reason);
  });

  socket.on('error', (err) => {
    console.error('❌ SOCKET ERROR');
    console.error(err);
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
    console.error('Disconnect error:', e);
  }

  socket = null;
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
};