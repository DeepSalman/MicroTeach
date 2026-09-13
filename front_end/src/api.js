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