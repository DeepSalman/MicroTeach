import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:3001/api" });

export const fetchUsers = () => API.get("/users");
export const fetchUserProfile = (userId) => API.get(`/users/profile/${userId}`);
export const updateUserProfile = (userId, data) => API.put(`/users/profile/${userId}`, data);
export const becomeTeacher = (userId, teacherData) => API.patch(`/users/profile/${userId}/become-teacher`, teacherData);
export const fetchTeachers = (department) => API.get('/users/teachers', { params: { department } });
export const registerUser = (userData) => API.post("/users/register", userData);
export const loginUser = (credentials) => API.post("/users/login", credentials);

export const fetchSkills = () => API.get("/skills");
export const addSkill = (skillData) => API.post("/skills", skillData);

export const fetchSessions = () => API.get("/sessions");
export const createSession = (sessionData) => API.post("/sessions", sessionData);

export const fetchPosts = (userId) => API.get("/posts", { params: { user_id: userId } });
export const createPost = (postData) => API.post("/posts", postData);
export const deletePost = (postId, userId) => API.delete(`/posts/${postId}`, { data: { user_id: userId } });
export const updatePostStatus = (postId, status) => API.patch(`/posts/${postId}/status`, { status });
export const fetchPostDetails = (postId, userId) => API.get(`/posts/${postId}`, { params: { user_id: userId } });
export const applyToPost = (postId, userId) => API.post(`/posts/${postId}/applications`, { user_id: userId });
export const acceptPostApplication = (postId, applicationId, userId) => API.patch(
	`/posts/${postId}/applications/${applicationId}/accept`,
	{ user_id: userId }
);
export const addPostComment = (postId, userId, commentText, parentCommentId = null) => API.post(`/posts/${postId}/comments`, {
	user_id: userId,
	comment_text: commentText,
	parent_comment_id: parentCommentId
});