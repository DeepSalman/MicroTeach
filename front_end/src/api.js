import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

const API = axios.create({ baseURL: API_BASE_URL });

export const fetchUsers = () => API.get("/users");
export const fetchUserProfile = (userId) => API.get(`/users/profile/${userId}`);
export const updateUserProfile = (userId, data) => API.put(`/users/profile/${userId}`, data);
export const updateUserVerification = (userId, is_verified) => API.patch(`/users/${userId}/verify`, { is_verified });
export const updateUserRole = (userId, role) => API.patch(`/users/${userId}/role`, { role });
export const registerUser = (userData) => API.post("/users/register", userData);
export const loginUser = (credentials) => API.post("/users/login", credentials);

export const fetchSkills = () => API.get("/skills");
export const addSkill = (skillData) => API.post("/skills", skillData);

export const fetchSessions = () => API.get("/sessions");
export const createSession = (sessionData) => API.post("/sessions", sessionData);

export const fetchPosts = () => API.get("/posts");
export const createPost = (postData) => API.post("/posts", postData);
export const updatePostStatus = (postId, status) => API.patch(`/posts/${postId}/status`, { status });
export const deletePost = (postId) => API.delete(`/posts/${postId}`);

export const fetchTeacherApplications = () => API.get("/teacher-applications");
export const fetchUserApplications = (userId) => API.get(`/teacher-applications/user/${userId}`);
export const submitTeacherApplication = (data) => API.post("/teacher-applications", data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const reviewTeacherApplication = (id, data) => API.put(`/teacher-applications/${id}/review`, data);

export const reportPost = (data) => API.post("/reports", data);
export const fetchReports = () => API.get("/reports");
export const updateReportStatus = (reportId, status, extra = {}) => API.patch(`/reports/${reportId}/status`, { status, ...extra });
export const takedownReportedPost = (reportId, data = {}) => API.post(`/reports/${reportId}/takedown`, data);
export const batchUpdateReportStatus = (data) => API.patch('/reports/batch-status', data);

export const fetchPostApplications = (postId) => API.get(`/post-applications/post/${postId}`);
export const fetchPostApplicationCount = (postId) => API.get(`/post-applications/post/${postId}/count`);
export const fetchUserPostApplications = (userId) => API.get(`/post-applications/user/${userId}`);
export const applyToPost = (data) => API.post("/post-applications", data);
export const withdrawApplication = (id) => API.delete(`/post-applications/${id}`);
export const updateApplicationStatus = (id, data) => API.patch(`/post-applications/${id}/status`, data);

// Messaging
export const fetchInbox = (userId) => API.get(`/messages/inbox/${userId}`);
export const fetchMessages = (conversationId, beforeSeq) => API.get(`/messages/${conversationId}/messages${beforeSeq ? `?before_seq=${beforeSeq}` : ''}`);
export const sendMessage = (conversationId, data) => {
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return API.post(`/messages/${conversationId}/messages`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
  return API.post(`/messages/${conversationId}/messages`, data);
};
export const markAsRead = (conversationId, data) => API.patch(`/messages/${conversationId}/read`, data);
export const startConversation = (data) => API.post('/messages/start', data);
export const fetchUnreadCount = (userId) => API.get(`/messages/unread/${userId}`);

// Wallet
export const fetchWalletBalance = (userId) => API.get(`/wallet/balance/${userId}`);
export const topUpWallet = (data) => API.post('/wallet/topup', data);
export const fetchTransactions = (userId) => API.get(`/wallet/transactions/${userId}`);

// Posts
export const closePost = (postId, userId) => API.post(`/posts/${postId}/close`, { user_id: userId });

// Reviews
export const submitReview = (data) => API.post('/reviews', data);
export const fetchUserReviews = (userId) => API.get(`/reviews/user/${userId}`);
export const checkReviewExists = (postId, reviewerId) => API.get(`/reviews/check/${postId}/${reviewerId}`);
export const fetchUserRating = (userId) => API.get(`/reviews/rating/${userId}`);
// Transaction Disputes & Escrow
export const fetchTransactionDisputes = () => API.get("/transaction-disputes");
export const checkTransactionDispute = (postId, userId) => API.get(`/transaction-disputes/check/${postId}/${userId}`);
export const submitTransactionDispute = (data) => API.post("/transaction-disputes", data);
export const resolveTransactionDispute = (id, data) => API.post(`/transaction-disputes/${id}/resolve`, data);
export const updateTransactionDisputeStatus = (id, status) => API.patch(`/transaction-disputes/${id}/status`, { status });

// Master Data
export const fetchMasterTransactionTypes = () => API.get("/master-data/transaction-types");
export const createOrUpdateTransactionType = (data) => API.post("/master-data/transaction-types", data);
export const toggleTransactionType = (typeCode) => API.patch(`/master-data/transaction-types/${typeCode}/toggle`);
export const fetchMasterTransactions = (params) => API.get("/master-data/transactions", { params });
export const fetchLedgerReconciliation = () => API.get("/master-data/reconciliation");
export const adjustUserBalance = (data) => API.post("/master-data/adjust-balance", data);
export const previewBatchAdjustment = (data) => API.post("/master-data/preview-batch-adjustment", data);
export const executeBatchAdjustment = (data) => API.post("/master-data/batch-adjust-balance", data);

