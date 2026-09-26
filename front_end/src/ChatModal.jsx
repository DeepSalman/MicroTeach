import React, { useState, useEffect, useRef } from 'react';
import { fetchInbox, fetchMessages, sendMessage, markAsRead, startConversation } from './api';
import './ChatModal.css';

const API_BASE = 'http://localhost:3001';

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

const ChatModal = ({ user, onClose, startWithUserId, startWithPostId }) => {
  const [inbox, setInbox] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); // { file, previewUrl, type, name, size }
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      setLoadingInbox(true);
      try {
        const response = await fetchInbox(user.user_id);
        setInbox(response.data);
      } catch (err) {
        console.error('Failed to load inbox:', err);
      } finally {
        setLoadingInbox(false);
      }

      if (startWithUserId) {
        const existing = inbox.find(c => String(c.other_user_id) === String(startWithUserId));
        if (existing) {
          setSelectedConv(existing);
        } else {
          try {
            await startConversation({
              user_id: user.user_id,
              other_user_id: startWithUserId,
              post_id: startWithPostId || null,
            });
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

  const loadInbox = async () => {
    try {
      const response = await fetchInbox(user.user_id);
      setInbox(response.data);
    } catch (err) {
      console.error('Failed to reload inbox:', err);
    }
  };

  const loadMessages = async (convId) => {
    setLoadingMessages(true);
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
      setLoadingMessages(false);
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
    if (file) {
      processFile(file);
    }
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
    if (file) {
      processFile(file);
    }
  };

  const clearSelectedFile = () => {
    if (selectedFile?.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }
    setSelectedFile(null);
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedConv || sending) return;

    const bodyText = newMessage.trim();
    const clientMsgId = crypto.randomUUID();
    const currentFile = selectedFile;

    setNewMessage('');
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
        <div
          className={`chat-main ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
        >
          {selectedConv ? (
            <>
              <div className="chat-main-header">
                <div className="chat-main-avatar">
                  {selectedConv.other_user_name?.charAt(0).toUpperCase()}
                </div>
                <div className="chat-main-info">
                  <div className="chat-main-name">{selectedConv.other_user_name}</div>
                  <div className="chat-main-dept">{selectedConv.other_user_department || 'Student / Tutor'}</div>
                </div>
                {selectedConv.course_code && (
                  <span className="chat-main-course">{selectedConv.course_code}</span>
                )}
              </div>

              {/* Drag overlay hint */}
              {isDragging && (
                <div className="chat-drag-overlay">
                  <div className="chat-drag-box">
                    <span className="chat-drag-icon">📁</span>
                    <span>Drop image or PDF to send in chat</span>
                  </div>
                </div>
              )}

              {/* Messages Container */}
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
                    const isImage = msg.kind === 'image';
                    const isPdf = msg.kind === 'pdf';
                    const hasText = msg.body && msg.body !== msg.file_name;

                    return (
                      <div key={msg.seq} className={`chat-msg ${isMine ? 'mine' : 'theirs'}`}>
                        {!isMine && showSender && (
                          <div className="chat-msg-sender">{msg.sender_name}</div>
                        )}

                        <div className={`chat-msg-bubble ${isImage ? 'has-image' : ''} ${isPdf ? 'has-pdf' : ''}`}>
                          {/* 1. Image message */}
                          {isImage && msg.file_path && (
                            <div className="chat-msg-image-wrap">
                              <img
                                src={getFileUrl(msg.file_path)}
                                alt={msg.file_name || 'Attached photo'}
                                className="chat-msg-img"
                                onClick={() => setPreviewImageModal(getFileUrl(msg.file_path))}
                                title="Click to view full photo"
                              />
                            </div>
                          )}

                          {/* 2. PDF message */}
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
                                title="Open / Download PDF"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                              </a>
                            </div>
                          )}

                          {/* 3. Text Body / Caption */}
                          {(!isImage && !isPdf) ? (
                            <span>{msg.body}</span>
                          ) : (
                            hasText && <div className="chat-msg-caption">{msg.body}</div>
                          )}
                        </div>

                        <div className="chat-msg-time">{formatMsgTime(msg.created_at)}</div>
                      </div>
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
                      <button type="button" className="chat-preview-close" onClick={clearSelectedFile} title="Remove PDF">
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Input Bar with Attachment Button */}
              <div className="chat-input-bar">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {/* Attachment Trigger Button */}
                <button
                  type="button"
                  className="chat-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach Picture or PDF (or drag and drop)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

                {/* Message Textarea (supports pasting screenshots) */}
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder={selectedFile ? "Add a caption (optional)..." : "Type a message, or paste an image..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={1}
                />

                {/* Send Button */}
                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={(!newMessage.trim() && !selectedFile) || sending}
                  title="Send message"
                >
                  {sending ? (
                    <span className="chat-send-spinner" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
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

      {/* Full Size Image Lightbox Modal */}
      {previewImageModal && (
        <div className="chat-lightbox-overlay" onClick={() => setPreviewImageModal(null)}>
          <div className="chat-lightbox-box" onClick={(e) => e.stopPropagation()}>
            <button className="chat-lightbox-close" onClick={() => setPreviewImageModal(null)}>&times;</button>
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
