import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getPersonName } from '../../utils/personUtils.js';
import '../../styles/chat.css';

export default function ChatModal({ open, onClose, expense, currentUser, token, initialUnreadCount = 0 }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const socketRef = useRef(null);

  const participants = useMemo(() => {
    const parts = (expense?.participants || [])
      .map(p => getPersonName(p?.userId, 'Member'))
      .filter((v, i, a) => a.indexOf(v) === i);

    if (parts.length === 0) return ['A', 'B'];
    if (parts.length === 1) return [parts[0], 'A'];
    return parts.slice(0, 3);
  }, [expense]);

  // Socket.IO setup: connect once and manage subscription/unsubscription per expense
  useEffect(() => {
    if (!token) return;

    // Initialize socket.io connection (reuse existing connection)
    if (!socketRef.current) {
      socketRef.current = io('/messages', {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected:', socketRef.current.id);
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Socket connect error:', err);
      });

      socketRef.current.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      socketRef.current.on('error', (err) => {
        console.error('Socket error:', err);
      });
    }

    return () => {
      // Don't disconnect on unmount, keep connection alive for other modals
    };
  }, [token]);

  // Load initial messages and subscribe to real-time updates
  useEffect(() => {
    if (!open || !expense?._id || !socketRef.current) return;

    const expenseId = expense._id;
    setLoading(true);
    setError(null);

    // Load initial messages
    const load = async () => {
      try {
        const res = await fetch(`/api/messages/${expenseId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Failed to load messages');
        const data = await res.json();
        setMessages(data.map(m => ({
          id: m._id,
          sender: m.senderName,
          text: m.text,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })));
        setLoading(false);
      } catch (err) {
        console.error('Chat load error', err);
        setError('Failed to load messages');
        setLoading(false);
      }
    };

    load();

    // Join expense room
    socketRef.current.emit('join-expense', expenseId);

    // Listen for new messages
    const handleMessageReceived = (msg) => {
      const newMsg = {
        id: msg._id,
        sender: msg.senderName,
        text: msg.text,
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, newMsg]);
    };

    socketRef.current.on('message-received', handleMessageReceived);

    // Cleanup
    return () => {
      socketRef.current?.off('message-received', handleMessageReceived);
      socketRef.current?.emit('leave-expense', expenseId);
    };
  }, [open, expense?._id, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !expense?._id) return;
    setSending(true);
    setError(null);

    const body = { text: text.trim() };
    try {
      const res = await fetch(`/api/messages/${expense._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to send');
      // Server will broadcast via socket, so no need to manually add
      // Just clear the input and let the socket listener handle adding the message
      setText('');
      setSending(false);
    } catch (err) {
      console.error('Send message failed', err);
      setError('Failed to send message');
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="chat-header">
          <div>
            <div className="chat-title">Chat about: {expense?.description || 'Expense'}</div>
            <div className="chat-sub">{participants.join(' · ')}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        {loading && (
          <div className="chat-loading" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            Loading messages…
          </div>
        )}

        {error && (
          <div className="chat-error" style={{ padding: '12px', background: '#fee', color: '#c00', fontSize: '12px', borderRadius: '4px', margin: '8px' }}>
            {error}
          </div>
        )}

        {!loading && (
          <div className="chat-body" ref={listRef}>
                {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 12px', color: '#999' }}>
                No messages yet. Start the conversation!
              </div>
            ) : (
                  messages.map((m, idx) => (
                    <div key={m.id}>
                      {initialUnreadCount > 0 && idx === messages.length - initialUnreadCount && (
                        <div className="chat-unread-divider">
                          <div className="line" />
                          <div className="label">{initialUnreadCount} new message{initialUnreadCount > 1 ? 's' : ''}</div>
                          <div className="line" />
                        </div>
                      )}
                      <div className={`chat-message ${m.sender === (currentUser?.name || 'You') ? 'me' : 'them'}`}>
                        <div className="chat-sender">{m.sender}</div>
                        <div className="chat-bubble">{m.text}</div>
                        <div className="chat-time">{m.time}</div>
                      </div>
                    </div>
                  ))
            )}
          </div>
        )}

        <div className="chat-input-row">
          <input
            className="input"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !sending) sendMessage(); }}
            disabled={sending}
          />
          <button
            className="btn btn-primary"
            onClick={sendMessage}
            disabled={sending || !text.trim()}
            style={{ position: 'relative' }}
          >
            {sending ? '⟳' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
