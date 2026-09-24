import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchInbox, fetchMessages, sendMessage, markAsRead, startConversation } from './api';
import './ChatModal.css';

const ChatModal = ({ user, onClose, startWithUserId }) => {
  const [inbox, setInbox] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const autoSelectedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const response = await fetchInbox(user.user_id);
      setInbox(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to load inbox:', err);
      return [];
    } finally {
      setLoadingInbox(false);
    }
  }, [user.user_id]);

  useEffect(() => {
    const init = async () => {
      const data = await loadInbox();

      if (startWithUserId && !autoSelectedRef.current) {
        autoSelectedRef.current = true;
        const existing = data.find(c => String(c.other_user_id) === String(startWithUserId));
        if (existing) {
          setSelectedConv(existing);
        } else {
          try {
            await startConversation({ user_id: user.user_id, other_user_id: startWithUserId });
            const updated = await fetchInbox(user.user_id);
            setInbox(updated.data);
            const conv = updated.data.find(c => String(c.other_user_id) === String(startWithUserId));
            if (conv) setSelectedConv(conv);
          } catch (err) {
            console.error('Failed to start conversation:', err);
          }
        }
      }
      setReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.conversation_id);
      inputRef.current?.focus();
    }
  }, [selectedConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (convId) => {
    setLoadingMessages(true);
    try {
      const response = await fetchMessages(convId);
      setMessages(response.data);
      // Mark as read with latest seq
      if (response.data.length > 0) {
        const latestSeq = response.data[response.data.length - 1].seq;
        await markAsRead(convId, { user_id: user.user_id, seq: latestSeq });
        loadInbox(); // refresh unread counts
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv || sending) return;
    const body = newMessage.trim();
    const clientMsgId = crypto.randomUUID();
    setNewMessage('');
    setSending(true);

    try {
      await sendMessage(selectedConv.conversation_id, {
        sender_id: user.user_id,
        body,
        client_msg_id: clientMsgId,
      });
      await loadMessages(selectedConv.conversation_id);
      loadInbox();
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(body);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatMsgTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        {/* Left: Conversation List */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>Messages</h3>
            <button className="chat-close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="chat-conv-list">
            {loadingInbox ? (
              <div className="chat-loading">Loading conversations...</div>
            ) : inbox.length === 0 ? (
              <div className="chat-empty">No conversations yet.</div>
            ) : (
              inbox.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className={`chat-conv-item ${selectedConv?.conversation_id === conv.conversation_id ? 'active' : ''}`}
                  onClick={() => setSelectedConv(conv)}
                >
                  <div className="chat-conv-avatar">
                    {conv.other_user_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-conv-info">
                    <div className="chat-conv-name-row">
                      <span className="chat-conv-name">{conv.other_user_name}</span>
                      <span className="chat-conv-time">{formatTime(conv.last_message_at)}</span>
                    </div>
                    <div className="chat-conv-preview">{conv.last_message_preview}</div>
                    {conv.course_code && <div className="chat-conv-course">{conv.course_code}</div>}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="chat-conv-badge">{conv.unread_count}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Message Thread */}
        <div className="chat-main">
          {selectedConv ? (
            <>
              <div className="chat-main-header">
                <div className="chat-main-avatar">
                  {selectedConv.other_user_name?.charAt(0).toUpperCase()}
                </div>
                <div className="chat-main-info">
                  <div className="chat-main-name">{selectedConv.other_user_name}</div>
                  <div className="chat-main-dept">{selectedConv.other_user_department}</div>
                </div>
                {selectedConv.course_code && (
                  <span className="chat-main-course">{selectedConv.course_code}</span>
                )}
              </div>

              <div className="chat-messages">
                {loadingMessages ? (
                  <div className="chat-loading">Loading messages...</div>
          ) : !ready ? (
            <div className="chat-no-selection">
              <div className="chat-loading-pulse">Loading conversation...</div>
            </div>
          ) : (
                  messages.map((msg, i) => {
                    const isMine = msg.sender_id === user.user_id;
                    const showSender = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
                    return (
                      <div key={msg.seq} className={`chat-msg ${isMine ? 'mine' : 'theirs'}`}>
                        {!isMine && showSender && (
                          <div className="chat-msg-sender">{msg.sender_name}</div>
                        )}
                        <div className="chat-msg-bubble">{msg.body}</div>
                        <div className="chat-msg-time">{formatMsgTime(msg.created_at)}</div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-bar">
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="chat-no-selection">
              <div className="chat-no-selection-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
