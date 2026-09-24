import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:3001/api" });

export const fetchUsers = () => API.get("/users");
export const fetchUserProfile = (userId) => API.get(`/users/profile/${userId}`);
export const updateUserProfile = (userId, data) => API.put(`/users/profile/${userId}`, data);
export const registerUser = (userData) => API.post("/users/register", userData);
export const loginUser = (credentials) => API.post("/users/login", credentials);

export const fetchSkills = () => API.get("/skills");
export const addSkill = (skillData) => API.post("/skills", skillData);

export const fetchSessions = () => API.get("/sessions");
export const createSession = (sessionData) => API.post("/sessions", sessionData);

export const fetchPosts = () => API.get("/posts");
export const createPost = (postData) => API.post("/posts", postData);
export const updatePostStatus = (postId, status) => API.patch(`/posts/${postId}/status`, { status });

export const fetchTeacherApplications = () => API.get("/teacher-applications");
export const fetchUserApplications = (userId) => API.get(`/teacher-applications/user/${userId}`);
export const submitTeacherApplication = (data) => API.post("/teacher-applications", data);
export const reviewTeacherApplication = (id, data) => API.put(`/teacher-applications/${id}/review`, data);

export const reportPost = (data) => API.post("/reports", data);
export const fetchReports = () => API.get("/reports");
export const updateReportStatus = (reportId, status) => API.patch(`/reports/${reportId}/status`, { status });

export const fetchPostApplications = (postId) => API.get(`/post-applications/post/${postId}`);
export const fetchPostApplicationCount = (postId) => API.get(`/post-applications/post/${postId}/count`);
export const fetchUserPostApplications = (userId) => API.get(`/post-applications/user/${userId}`);
export const applyToPost = (data) => API.post("/post-applications", data);
export const withdrawApplication = (id) => API.delete(`/post-applications/${id}`);
export const updateApplicationStatus = (id, data) => API.patch(`/post-applications/${id}/status`, data);

// Messaging
export const fetchInbox = (userId) => API.get(`/messages/inbox/${userId}`);
export const fetchMessages = (conversationId, beforeSeq) => API.get(`/messages/${conversationId}/messages${beforeSeq ? `?before_seq=${beforeSeq}` : ''}`);
export const sendMessage = (conversationId, data) => API.post(`/messages/${conversationId}/messages`, data);
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