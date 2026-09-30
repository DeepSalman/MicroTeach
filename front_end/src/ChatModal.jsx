import React, { useState, useEffect, useRef } from 'react';
import { fetchInbox, fetchMessages, sendMessage, markAsRead, startConversation } from './api';
import { avatarStyle } from './utils';
import './ChatModal.css';

const API_BASE =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3001');

const QUICK_EMOJIS = ['👍', '📚', '💡', '✅', '🙌', '❓', '❤️', '🔥'];

const getFileUrl = (filePath) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const clean = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  return `${API_BASE}/${clean}`;
};

const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Deduplicate inbox so each user appears strictly ONCE (single chat per person)
const dedupeInbox = (data) => {
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  const unique = [];
  for (const item of data) {
    const key = String(item.other_user_id);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
};

const ChatModal = ({ user, onClose, startWithUserId, startWithPostId }) => {
  const [inbox, setInbox] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  // --- Initial Load & Conversation Selection ---
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoadingInbox(true);
      let inboxList = [];
      try {
        const response = await fetchInbox(user.user_id);
        inboxList = dedupeInbox(response.data);
        if (isMounted) setInbox(inboxList);
      } catch (err) {
        console.error('Failed to load inbox:', err);
      } finally {
        if (isMounted) setLoadingInbox(false);
      }

      if (startWithUserId) {
        // Find existing single chat with this person
        const existing = inboxList.find(c => String(c.other_user_id) === String(startWithUserId));
        if (existing) {
          if (isMounted) setSelectedConv(existing);
        } else {
          try {
            const res = await startConversation({
              user_id: user.user_id,
              other_user_id: startWithUserId,
              post_id: startWithPostId || null,
            });
            const updated = await fetchInbox(user.user_id);
            const dedupedUpdated = dedupeInbox(updated.data);
            if (isMounted) {
              setInbox(dedupedUpdated);
              const targetId = res.data?.conversation_id;
              const conv = dedupedUpdated.find(
                c => c.conversation_id === targetId || String(c.other_user_id) === String(startWithUserId)
              );
              if (conv) setSelectedConv(conv);
            }
          } catch (err) {
            console.error('Failed to start conversation:', err);
          }
        }
      }
      if (isMounted) setReady(true);
    };

    init();

    return () => {
      isMounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // --- Auto-poll messages periodically when conversation is open ---
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (selectedConv) {
      loadMessages(selectedConv.conversation_id);
      inputRef.current?.focus();

      pollRef.current = setInterval(() => {
        loadMessages(selectedConv.conversation_id, true);
      }, 7000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedConv]);

  // --- Scroll to bottom when messages update ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Keyboard Shortcuts (Escape to close) ---
  useEffect(() => {
    const handleKeyDownGlobal = (e) => {
      if (e.key === 'Escape') {
        if (previewImageModal) {
          setPreviewImageModal(null);
        } else if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [previewImageModal, showEmojiPicker, onClose]);

  const loadInbox = async () => {
    try {
      const response = await fetchInbox(user.user_id);
      setInbox(dedupeInbox(response.data));
    } catch (err) {
      console.error('Failed to reload inbox:', err);
    }
  };

  const loadMessages = async (convId, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const response = await fetchMessages(convId);
      setMessages(response.data);
      if (response.data.length > 0) {
        const latestSeq = response.data[response.data.length - 1].seq;
        await markAsRead(convId, { user_id: user.user_id, seq: latestSeq });
        loadInbox();
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      alert('Only images (JPEG, PNG, WEBP, GIF) and PDF documents are supported.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds the 25 MB limit.');
      return;
    }

    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    setSelectedFile({
      file,
      previewUrl,
      type: isPdf ? 'pdf' : 'image',
      name: file.name,
      size: file.size
    });
    inputRef.current?.focus();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          processFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const clearSelectedFile = () => {
    if (selectedFile?.previewUrl) URL.revokeObjectURL(selectedFile.previewUrl);
    setSelectedFile(null);
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedConv || sending) return;

    const bodyText = newMessage.trim();
    const clientMsgId = crypto.randomUUID();
    const currentFile = selectedFile;

    setNewMessage('');
    setShowEmojiPicker(false);
    clearSelectedFile();
    setSending(true);

    try {
      if (currentFile) {
        const formData = new FormData();
        formData.append('sender_id', user.user_id);
        formData.append('body', bodyText);
        formData.append('client_msg_id', clientMsgId);
        formData.append('attachment', currentFile.file);
        await sendMessage(selectedConv.conversation_id, formData);
      } else {
        await sendMessage(selectedConv.conversation_id, {
          sender_id: user.user_id,
          body: bodyText,
          client_msg_id: clientMsgId,
        });
      }
      await loadMessages(selectedConv.conversation_id);
      loadInbox();
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(bodyText);
      if (currentFile) setSelectedFile(currentFile);
      alert(err.response?.data?.message || 'Failed to send message.');
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

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const handleAddEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatMsgTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const needsDateSep = (msg, prevMsg) => {
    if (!prevMsg) return true;
    const d1 = new Date(msg.created_at).toDateString();
    const d2 = new Date(prevMsg.created_at).toDateString();
    return d1 !== d2;
  };

  // Filter single-chat inbox by search query
  const filteredInbox = searchQuery.trim()
    ? inbox.filter(c =>
        c.other_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.course_code?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : inbox;

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        {/* ═══ Left: Conversation List ═══ */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div className="chat-sidebar-title-row">
              <h3>Messages</h3>
              <span className="chat-sidebar-count">{inbox.length}</span>
            </div>
            <button className="chat-close-btn" onClick={onClose} title="Close (Esc)">
              &times;
            </button>
          </div>

          {/* Search Bar with Centered Icon */}
          <div className="chat-search-wrap">
            <div className="chat-search-box">
              <svg className="chat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="chat-search-input"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="chat-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          <div className="chat-conv-list">
            {loadingInbox ? (
              <div className="chat-loading">
                <div className="chat-loading-pulse">Loading conversations...</div>
              </div>
            ) : filteredInbox.length === 0 ? (
              <div className="chat-empty">
                {searchQuery ? 'No matching conversations.' : 'No conversations yet.'}
              </div>
            ) : (
              filteredInbox.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className={`chat-conv-item ${selectedConv?.conversation_id === conv.conversation_id ? 'active' : ''}`}
                  onClick={() => setSelectedConv(conv)}
                >
                  <div className="chat-conv-avatar-wrap">
                    <div className="chat-conv-avatar" style={avatarStyle(conv.other_user_avatar_color)}>
                      {conv.other_user_name?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="chat-conv-info">
                    <div className="chat-conv-name-row">
                      <span className="chat-conv-name">{conv.other_user_name}</span>
                      <span className="chat-conv-time">{formatTime(conv.last_message_at)}</span>
                    </div>
                    <div className="chat-conv-preview">{conv.last_message_preview || 'No messages yet'}</div>
                    {conv.course_code && <div className="chat-conv-course">{conv.course_code}</div>}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="chat-conv-badge">{conv.unread_count}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ═══ Right: Message Thread ═══ */}
        <main
          className={`chat-main ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="chat-main-header">
                <div className="chat-main-avatar-wrap">
                  <div className="chat-main-avatar" style={avatarStyle(selectedConv.other_user_avatar_color)}>
                    {selectedConv.other_user_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="chat-online-indicator" title="Active on MicroTeach" />
                </div>
                <div className="chat-main-info">
                  <div className="chat-main-name">{selectedConv.other_user_name}</div>
                  <div className="chat-main-dept">{selectedConv.other_user_department || 'Student / Tutor'}</div>
                </div>
                {selectedConv.course_code && (
                  <span className="chat-main-course" title={`Session Context: ${selectedConv.post_title || selectedConv.course_code}`}>
                    {selectedConv.course_code}
                  </span>
                )}
              </div>

              {/* Drag overlay hint */}
              {isDragging && (
                <div className="chat-drag-overlay">
                  <div className="chat-drag-box">
                    <span className="chat-drag-icon">📁</span>
                    <span>Drop image or PDF to attach</span>
                  </div>
                </div>
              )}

              {/* Messages Container */}
              <div className="chat-messages">
                {loadingMessages ? (
                  <div className="chat-loading">
                    <div className="chat-loading-pulse">Loading messages...</div>
                  </div>
                ) : !ready ? (
                  <div className="chat-no-selection">
                    <div className="chat-loading-pulse">Loading conversation...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-thread">
                    <div className="chat-empty-thread-icon">👋</div>
                    <h4>Start a conversation</h4>
                    <p>Send a message to {selectedConv.other_user_name} about peer tutoring</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMine = msg.sender_id === user.user_id;
                    const showSender = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
                    const isImage = msg.kind === 'image';
                    const isPdf = msg.kind === 'pdf';
                    const hasText = msg.body && msg.body !== msg.file_name;
                    const showDate = needsDateSep(msg, messages[i - 1]);

                    return (
                      <React.Fragment key={msg.seq}>
                        {showDate && (
                          <div className="chat-date-separator">
                            <span>{formatDateLabel(msg.created_at)}</span>
                          </div>
                        )}

                        <div className={`chat-msg ${isMine ? 'mine' : 'theirs'}`}>
                          {!isMine && showSender && (
                            <div className="chat-msg-sender">{msg.sender_name}</div>
                          )}

                          <div className={`chat-msg-bubble ${isImage ? 'has-image' : ''} ${isPdf ? 'has-pdf' : ''}`}>
                            {/* Image Message */}
                            {isImage && msg.file_path && (
                              <div className="chat-msg-image-wrap">
                                <img
                                  src={getFileUrl(msg.file_path)}
                                  alt={msg.file_name || 'Attached photo'}
                                  className="chat-msg-img"
                                  onClick={() => setPreviewImageModal(getFileUrl(msg.file_path))}
                                  onLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                  title="Click to view full photo"
                                  loading="lazy"
                                />
                              </div>
                            )}

                            {/* PDF Document Message */}
                            {isPdf && msg.file_path && (
                              <div className="chat-msg-pdf-card">
                                <div className="chat-pdf-icon-badge">
                                  <span>PDF</span>
                                </div>
                                <div className="chat-pdf-details">
                                  <span className="chat-pdf-name" title={msg.file_name || msg.body}>
                                    {msg.file_name || 'Document.pdf'}
                                  </span>
                                  {msg.file_size && (
                                    <span className="chat-pdf-size">{formatFileSize(msg.file_size)}</span>
                                  )}
                                </div>
                                <a
                                  href={getFileUrl(msg.file_path)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="chat-pdf-action-btn"
                                  title="Open / Download Document"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                </a>
                              </div>
                            )}

                            {/* Text Body / Caption */}
                            {(!isImage && !isPdf) ? (
                              <span>{msg.body}</span>
                            ) : (
                              hasText && <div className="chat-msg-caption">{msg.body}</div>
                            )}
                          </div>

                          <div className="chat-msg-time">
                            {formatMsgTime(msg.created_at)}
                            {isMine && <span className="chat-check-icon">✓✓</span>}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Pre-upload File Preview Strip */}
              {selectedFile && (
                <div className="chat-file-preview-strip">
                  {selectedFile.type === 'image' ? (
                    <div className="chat-preview-item image">
                      <img src={selectedFile.previewUrl} alt="Preview" className="chat-preview-img" />
                      <div className="chat-preview-info">
                        <span className="chat-preview-filename">{selectedFile.name}</span>
                        <span className="chat-preview-filesize">{formatFileSize(selectedFile.size)}</span>
                      </div>
                      <button type="button" className="chat-preview-close" onClick={clearSelectedFile} title="Remove image">
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div className="chat-preview-item pdf">
                      <div className="chat-preview-pdf-icon">PDF</div>
                      <div className="chat-preview-info">
                        <span className="chat-preview-filename">{selectedFile.name}</span>
                        <span className="chat-preview-filesize">{formatFileSize(selectedFile.size)}</span>
                      </div>
                      <button type="button" className="chat-preview-close" onClick={clearSelectedFile} title="Remove document">
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Emoji Reaction Pill Strip */}
              {showEmojiPicker && (
                <div className="chat-emoji-strip">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="chat-emoji-item"
                      onClick={() => handleAddEmoji(emoji)}
                      title={`Insert ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Bar */}
              <div className="chat-input-bar">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                <div className="chat-action-buttons">
                  {/* Attachment Button */}
                  <button
                    type="button"
                    className="chat-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach Picture or PDF"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>

                  {/* Emoji Quick Picker Button */}
                  <button
                    type="button"
                    className={`chat-emoji-btn ${showEmojiPicker ? 'active' : ''}`}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Quick Reactions"
                  >
                    😊
                  </button>
                </div>

                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder={selectedFile ? "Add an optional caption..." : "Type a message, or paste a screenshot..."}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={1}
                />

                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={(!newMessage.trim() && !selectedFile) || sending}
                  title="Send message (Enter)"
                >
                  {sending ? (
                    <span className="chat-send-spinner" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="chat-no-selection">
              <div className="chat-no-selection-icon">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p>Select a conversation</p>
              <span className="chat-no-hint">Choose a contact on the left to start messaging</span>
            </div>
          )}
        </main>
      </div>

      {/* Full Size Image Lightbox Modal */}
      {previewImageModal && (
        <div className="chat-lightbox-overlay" onClick={() => setPreviewImageModal(null)}>
          <div className="chat-lightbox-box" onClick={(e) => e.stopPropagation()}>
            <button className="chat-lightbox-close" onClick={() => setPreviewImageModal(null)} title="Close">&times;</button>
            <img src={previewImageModal} alt="Enlarged view" className="chat-lightbox-img" />
            <div className="chat-lightbox-actions">
              <a href={previewImageModal} target="_blank" rel="noreferrer" download className="chat-lightbox-download">
                ⬇ Open Original
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModal;
