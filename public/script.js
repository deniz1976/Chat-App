const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginStatus = document.getElementById('login-status');

const chatContainer = document.getElementById('chat-container');
const sidebar = document.getElementById('sidebar');
const userInfoDiv = document.getElementById('user-info');
const currentUsernameSpan = document.getElementById('current-username');
const chatListUl = document.getElementById('chat-list');
const disconnectButton = document.getElementById('disconnect-ws');

const mainContent = document.getElementById('main-content');
const chatHeader = document.getElementById('chat-header');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');

const attachImageButton = document.getElementById('attach-image');
const imageUploadInput = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageButton = document.getElementById('remove-image');

const registerContainer = document.getElementById('register-container');
const registerForm = document.getElementById('register-form');
const registerUsernameInput = document.getElementById('register-username');
const registerDisplayNameInput = document.getElementById('register-displayname');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const registerStatus = document.getElementById('register-status');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');

const startChatBtn = document.getElementById('start-chat-btn');
const newChatModal = document.getElementById('new-chat-modal');
const closeModalBtn = document.querySelector('.close-modal');
const usernameSearchInput = document.getElementById('username-search');
const searchStatusText = document.getElementById('search-status');
const searchResultsDiv = document.getElementById('search-results');
const createChatBtn = document.getElementById('create-chat-btn');
const cancelChatBtn = document.getElementById('cancel-chat-btn');

const userAvatarDiv = document.getElementById('user-avatar');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const avatarUploadInput = document.getElementById('avatar-upload-input');
const avatarUploadStatus = document.getElementById('avatar-upload-status');

let jwtToken = localStorage.getItem('chatToken');
let websocket = null;
let currentUserId = null;
let currentUsername = null;
let selectedChatId = null;
let chatCache = {};
let userCache = {};
let isPickerOpen = false;
let userStatuses = new Map(); 
let selectedUserId = null;
let searchTimeout = null;
let isLightboxOpen = false;

const API_BASE_URL = '/api/v1';
const WS_BASE_URL = `ws://${window.location.host}`;

function showLoginForm() {
    loginContainer.classList.remove('hidden');
    registerContainer.classList.add('hidden');
    loginStatus.textContent = '';
    registerStatus.textContent = '';
}

function showRegisterForm() {
    loginContainer.classList.add('hidden');
    registerContainer.classList.remove('hidden');
    loginStatus.textContent = '';
    registerStatus.textContent = '';
}

async function registerUser(username, displayName, email, password) {
    try {
        registerStatus.textContent = 'Registering...';
        
        const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
        headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                email,
                password,
                displayName
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }
        
        registerStatus.textContent = 'Registration successful! Redirecting to login...';
        registerStatus.style.color = 'green';
        
        setTimeout(() => {
            showLoginForm();
            if (loginEmailInput) {
                loginEmailInput.value = email;
            }
        }, 2000);
    } catch (error) {
        console.error('Registration error:', error);
        registerStatus.textContent = 'Registration failed: ' + (error.message || 'Unknown error');
        registerStatus.style.color = 'red';
    }
}

async function fetchApi(endpoint, options = {}) {
    if (!jwtToken && !endpoint.includes('login')) {
        console.error('No JWT token available');
        updateLoginState();
        return null;
    }

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': jwtToken ? `Bearer ${jwtToken}` : ''
        }
    };

    try {
        const url = endpoint.startsWith('/') ? `/api/v1${endpoint}` : `/api/v1/${endpoint}`;
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            logoutUser();
            return null;
        }
        
    if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return null;
    }
}

async function loginUser(email, password) {
    loginStatus.textContent = 'Logging in...';
    try {
        const data = await fetchApi('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        
        if (!data || !data.token) {
             throw new Error('Login failed: No token received.');
        }
        
        jwtToken = data.token;
        currentUserId = data.user.id;
        currentUsername = data.user.username;
        localStorage.setItem('chatToken', jwtToken);
        updateLoginState(true);
    } catch (error) {
        console.error('Login error:', error);
        loginStatus.textContent = `Error: ${error.message}`;
        jwtToken = null;
        currentUserId = null;
        currentUsername = null;
        localStorage.removeItem('chatToken');
        
    }
}

async function fetchChats() {
    try {
        const chats = await fetchApi('/chats');
        if (chats) {
        displayChatList(chats);
        }
    } catch (error) {
        console.error('Error fetching chats:', error);
    }
}

async function fetchMessages(chatId) {
    if (!chatId) return;
    
    messagesDiv.innerHTML = '<p>Loading messages...</p>';
    
    try {
        console.log(`Fetching messages for chat: ${chatId}`);
        
        const url = `/api/v1/messages/chat/${chatId}?limit=100`;
        console.log(`Requesting URL: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const messages = await response.json();
        console.log(`Retrieved ${messages ? messages.length : 0} messages`);
        
        if (messages && Array.isArray(messages)) {
        messagesDiv.innerHTML = '';
            messages.forEach(message => {
                if (!document.querySelector(`[data-message-id="${message.id}"]`)) {
                    displayMessage(message);
                }
            });
        scrollToBottom();
        } else {
            console.error('Received non-array response:', messages);
            messagesDiv.innerHTML = '<p>No messages yet.</p>';
        }
    } catch (error) {
        console.error(`Error fetching messages for chat ${chatId}:`, error);
        messagesDiv.innerHTML = `<p>Error loading messages: ${error.message}</p>`;
    }
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/v1/upload/image', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

async function sendMessage(chatId, content, imageUrl = null) {
    try {
        if (imageUrl) {
            clearImagePreview();
        }
        
        if ((content && content.trim()) || imageUrl) {
            const tempId = 'temp-' + Date.now();
            
        const tempMessage = {
                id: tempId,
            senderId: currentUserId,
            chatId: chatId,
                content: content || 'Image sent',
                type: imageUrl ? 'image' : 'text',
                mediaUrl: imageUrl,
                createdAt: new Date().toISOString()
            };
            
            messageInput.value = '';
            
            displayMessage(tempMessage);
        updateChatListPreview(chatId, tempMessage);
        
            const messageData = {
                chatId,
                content: content || 'Image sent',
                type: imageUrl ? 'image' : 'text',
                mediaUrl: imageUrl
            };

            console.log('Sending message to API:', messageData);
            
            const response = await fetch('/api/v1/messages', {
            method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify(messageData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const messageResponse = await response.json();
            console.log('Message API response:', messageResponse);
            
            if (messageResponse && messageResponse.id) {
                const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
                if (tempElement) {
                    tempElement.setAttribute('data-message-id', messageResponse.id);
                }
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error sending message:', error);
        return false;
    }
}

async function fetchUserInfo(userId) {
    if (userCache[userId]) {
        return userCache[userId];
    }
    try {
        const user = await fetchApi(`/users/${userId}`);
        userCache[userId] = user;
        return user;
    } catch (error) {
        console.error(`Error fetching user info for ${userId}:`, error);
        return null;
    }
}

const WS_MESSAGE_TYPES = {
    NEW_MESSAGE: 'NEW_MESSAGE',
    READ_RECEIPT: 'READ_RECEIPT',
    USER_STATUS: 'USER_STATUS',
    CHAT_CREATED: 'CHAT_CREATED',
    ERROR: 'ERROR'
};

function connectWebSocket() {
    if (!jwtToken) return;
    if (websocket && websocket.readyState === WebSocket.OPEN) return;

    console.log('WebSocket: Connecting...');
    websocket = new WebSocket(`${WS_BASE_URL}?token=${jwtToken}`);

    websocket.onopen = () => {
        console.log('WebSocket: Connected');
        disconnectButton.classList.remove('hidden');
        
        if (currentUserId) {
            handleUserStatusChange({
                userId: currentUserId,
                status: 'online'
            });
        }
        
        fetchChats().then(() => {
            for (const [userId, status] of userStatuses.entries()) {
                if (userCache[userId]) {
                    updateUserStatusIndicator(userId);
                }
            }
            
            if (selectedChatId && chatCache[selectedChatId]) {
                const chat = chatCache[selectedChatId];
                if (chat.type === 'direct' && chat.otherParticipant) {
                    const otherUserId = chat.otherParticipant.id;
                    updateUserStatusIndicator(otherUserId);
                }
            }
        });
    };

    websocket.onmessage = (event) => {
        try {
            const messageData = JSON.parse(event.data);
            console.log('WS message received:', messageData);
            
            switch (messageData.type) {
                case WS_MESSAGE_TYPES.NEW_MESSAGE:
                    handleNewMessage(messageData.payload);
                    break;
                case WS_MESSAGE_TYPES.READ_RECEIPT:
                    handleReadReceipt(messageData.payload);
                    break;
                case WS_MESSAGE_TYPES.USER_STATUS:
                    handleUserStatusChange(messageData.payload);
                    break;
                case WS_MESSAGE_TYPES.ERROR:
                    console.error('WebSocket error from server:', messageData.payload);
                    break;
                default:
                    console.warn('Unknown message type:', messageData.type);
            }
        } catch (e) {
            console.error('Failed to parse WebSocket message:', event.data, e);
        }
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        disconnectButton.classList.add('hidden');
    };

    websocket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        
        if (currentUserId) {
            handleUserStatusChange({
                userId: currentUserId,
                status: 'offline'
            });
        }
        
        websocket = null;
        disconnectButton.classList.add('hidden');
    };
}

function handleNewMessage(payload) {
    console.log('Handling new message:', payload);
    
    if (payload.id && payload.id.toString().startsWith('temp-')) {
        console.log('Ignoring temporary message:', payload.id);
        return;
    }
    
    const existingMessage = document.querySelector(`[data-message-id="${payload.id}"]`);
    if (existingMessage) {
        console.log('Message already displayed, skipping:', payload.id);
        return;
    }
    
    if (payload.chatId === selectedChatId) {
        displayMessage(payload);
        
        if (payload.senderId !== currentUserId) {
            sendReadReceipt(payload.chatId, payload.id);
        }
    } else {
        if (payload.senderId !== currentUserId) {
            let senderName = 'Unknown';
            if (payload.sender) {
                senderName = payload.sender.username;
            } else if (userCache[payload.senderId]) {
                senderName = userCache[payload.senderId].username;
            }
            
            showNotification(`New message from @${senderName}`);
        }
    }
    
    updateChatListPreview(payload.chatId, payload);
}

function handleReadReceipt(payload) {
    if (payload.chatId === selectedChatId) {
        const messageElement = document.querySelector(`[data-message-id="${payload.messageId}"]`);
        if (messageElement) {
            messageElement.classList.add('read');
            
            const readIndicator = messageElement.querySelector('.read-status');
            if (readIndicator) {
                readIndicator.textContent = '✓✓'; 
                readIndicator.classList.add('read');
            }
        }
    }
}

function handleUserStatusChange(payload) {
    console.log('Status change received:', payload);
    const { userId, status } = payload;
    
    const oldStatus = userStatuses.get(userId);
    userStatuses.set(userId, status);
    
    console.log(`User ${userId} status changed: ${oldStatus || 'unknown'} -> ${status}`);
    
    if (userCache[userId]) {
        updateUserStatusIndicator(userId);
        
        if (status === 'online' && oldStatus !== 'online' && userId !== currentUserId) {
            showNotification(`${userCache[userId].username} is now online`);
        }
    } else {
        fetchUserInfo(userId).then(user => {
            if (user) {
                updateUserStatusIndicator(userId);
                
                if (status === 'online' && oldStatus !== 'online' && userId !== currentUserId) {
                    showNotification(`${user.username} is now online`);
                }
            }
        }).catch(err => {
            console.error(`Could not fetch user info for status update: ${userId}`, err);
        });
    }
}

function displayMessage(message) {
    if (document.querySelector(`[data-message-id="${message.id}"]`)) {
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.dataset.messageId = message.id;

    if (message.senderId === currentUserId) {
        messageDiv.classList.add('sent');
    } else {
        messageDiv.classList.add('received');
    }

    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    
    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('message-avatar');
    
    let senderUsername = 'Unknown';
    let senderProfileImage = null;
    
    if (message.sender) {
        senderUsername = message.sender.username || 'Unknown';
        senderProfileImage = message.sender.profileImage;
    } else if (message.senderId === currentUserId) {
        senderUsername = currentUsername;
    } else if (userCache[message.senderId]) {
        senderUsername = userCache[message.senderId].username;
        senderProfileImage = userCache[message.senderId].profileImage;
    }
    
    if (senderProfileImage) {
        const img = document.createElement('img');
        img.src = senderProfileImage;
        img.alt = senderUsername;
        avatarDiv.appendChild(img);
        
        avatarDiv.addEventListener('click', () => {
            openLightbox(senderProfileImage);
        });
    } else {
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'avatar-placeholder';
        placeholderDiv.textContent = senderUsername.charAt(0).toUpperCase();
        avatarDiv.appendChild(placeholderDiv);
    }
    
    const senderName = document.createElement('div');
    senderName.classList.add('message-sender');
    senderName.textContent = senderUsername;
    
    messageHeader.appendChild(avatarDiv);
    messageHeader.appendChild(senderName);
    messageDiv.appendChild(messageHeader);
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    messageContent.textContent = message.content;
    
    if (message.type === 'image' && message.mediaUrl) {
        messageContent.textContent = '';
        
        const imageElement = document.createElement('img');
        imageElement.src = message.mediaUrl;
        imageElement.alt = 'Sent image';
        imageElement.classList.add('message-image');
        imageElement.addEventListener('click', () => {
            openLightbox(message.mediaUrl);
        });
        messageContent.appendChild(imageElement);
    }
    
    const messageTime = document.createElement('div');
    messageTime.classList.add('message-time');
    messageTime.textContent = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (message.senderId === currentUserId) {
        const readStatus = document.createElement('span');
        readStatus.className = 'read-status';
        const isRead = message.readBy && Array.isArray(message.readBy) && 
                       message.readBy.some(id => id !== currentUserId);
        
        readStatus.textContent = isRead ? '✓✓' : '✓';
        readStatus.classList.toggle('read', isRead);
        messageDiv.appendChild(readStatus);
    }
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageTime);
    
    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
    
    if (message.senderId !== currentUserId && selectedChatId && !message.id.toString().startsWith('temp-')) {
        sendReadReceipt(selectedChatId, message.id);
    }
}

async function displayChatList(chats) {
    chatListUl.innerHTML = '';
    chatCache = {};
    
    if (!chats || chats.length === 0) {
        chatListUl.innerHTML = '<li>No chats found.</li>';
        return;
    }
    
    for (const chat of chats) {
        chatCache[chat.id] = chat;
        const li = document.createElement('li');
        li.dataset.chatId = chat.id;
        let chatName = chat.name;
        let otherParticipant = null;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        
        const chatInfo = document.createElement('div');
        chatInfo.className = 'chat-info';
        
        if (chat.type === 'direct' && chat.participants) {
            const otherUserId = chat.participants.find(id => id !== currentUserId);
            if (otherUserId) {
                otherParticipant = await fetchUserInfo(otherUserId);
                chatName = otherParticipant?.username || 'Direct Chat';
                chatCache[chat.id].otherParticipant = otherParticipant;
                
                if (otherParticipant.profileImage) {
                    const img = document.createElement('img');
                    img.src = otherParticipant.profileImage;
                    img.alt = otherParticipant.username;
                    avatarDiv.appendChild(img);
                    
                    avatarDiv.addEventListener('click', (e) => {
                        e.stopPropagation(); 
                        openLightbox(otherParticipant.profileImage);
                    });
                } else {
                    const placeholderDiv = document.createElement('div');
                    placeholderDiv.className = 'avatar-placeholder';
                    placeholderDiv.textContent = otherParticipant.username.charAt(0).toUpperCase();
                    avatarDiv.appendChild(placeholderDiv);
                }
                
                if (otherParticipant.id) {
                    const userStatus = userStatuses.get(otherParticipant.id) || 'offline';
                    li.classList.add(`status-${userStatus}`);
                }
            }
        } else {
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'avatar-placeholder';
            placeholderDiv.textContent = (chat.name || 'G').charAt(0).toUpperCase();
            avatarDiv.appendChild(placeholderDiv);
        }
        
        chatName = chatName || 'Unnamed Chat';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-name';
        nameSpan.textContent = chatName;
        
        const lastMsgSpan = document.createElement('span');
        lastMsgSpan.className = 'chat-last-message';
        lastMsgSpan.textContent = chat.lastMessage?.content || 'No messages yet';
        lastMsgSpan.id = `last-msg-${chat.id}`;
        
        chatInfo.appendChild(nameSpan);
        chatInfo.appendChild(lastMsgSpan);
        
        li.appendChild(avatarDiv);
        li.appendChild(chatInfo);
        
        if (chat.type === 'direct' && otherParticipant) {
            const statusIndicator = document.createElement('span');
            statusIndicator.className = 'status-indicator';
            li.appendChild(statusIndicator);
        }
        
        li.addEventListener('click', () => selectChat(chat.id));
        chatListUl.appendChild(li);
        
        if (chat.type === 'direct' && otherParticipant && otherParticipant.id) {
            updateUserStatusIndicator(otherParticipant.id);
        }
    }
}

function selectChat(chatId) {
    if (selectedChatId === chatId) return;
    selectedChatId = chatId;
    const selectedChat = chatCache[chatId];
    document.querySelectorAll('#chat-list li').forEach(li => {
        li.classList.toggle('active', li.dataset.chatId === chatId);
    });
    
    chatHeader.innerHTML = '';
    
    let headerTitle = 'Chat';
    let profileImage = null;
    
    if (selectedChat) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        
        if (selectedChat.type === 'group') {
            headerTitle = selectedChat.name || 'Group Chat';
            
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'avatar-placeholder';
            placeholderDiv.textContent = (selectedChat.name || 'G').charAt(0).toUpperCase();
            avatarDiv.appendChild(placeholderDiv);
            
        } else if (selectedChat.otherParticipant) {
            headerTitle = selectedChat.otherParticipant.username || 'Direct Chat';
            profileImage = selectedChat.otherParticipant.profileImage;
            
            if (profileImage) {
                const img = document.createElement('img');
                img.src = profileImage;
                img.alt = headerTitle;
                avatarDiv.appendChild(img);
                
                avatarDiv.addEventListener('click', () => {
                    openLightbox(profileImage);
                });
            } else {
                const placeholderDiv = document.createElement('div');
                placeholderDiv.className = 'avatar-placeholder';
                placeholderDiv.textContent = headerTitle.charAt(0).toUpperCase();
                avatarDiv.appendChild(placeholderDiv);
            }
            
            if (selectedChat.otherParticipant.id) {
                updateUserStatusIndicator(selectedChat.otherParticipant.id);
            }
        } else {
            headerTitle = 'Direct Chat';
            
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'avatar-placeholder';
            placeholderDiv.textContent = 'C';
            avatarDiv.appendChild(placeholderDiv);
        }
        
        chatHeader.appendChild(avatarDiv);
        
        const titleElement = document.createElement('h2');
        titleElement.textContent = headerTitle;
        chatHeader.appendChild(titleElement);
    }
    
    fetchMessages(chatId);
    messageForm.classList.remove('hidden');
}

function updateChatListPreview(chatId, lastMessage) {
    const lastMsgSpan = document.getElementById(`last-msg-${chatId}`);
    if (lastMsgSpan && lastMessage) {
        lastMsgSpan.textContent = lastMessage.content;
    }
}

function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateLoginState(isLoginSuccess = false) {
    if (localStorage.getItem('chatToken')) {
        jwtToken = localStorage.getItem('chatToken');
        if (!currentUserId || !currentUsername) {
            fetchApi('/users/profile')
                .then(user => {
                    if (user) {
                        currentUserId = user.id;
                        currentUsername = user.username;
                        updateCurrentUserProfile(user);
                        
                        loginStatus.textContent = '';
                        registerStatus.textContent = '';
                        finalizeLoginState(true);
                    } else {
                        logoutUser();
                    }
                })
                .catch(err => {
                    console.error("Error fetching profile on load:", err);
                    logoutUser();
                });
        } else {
             fetchApi('/users/profile').then(user => updateCurrentUserProfile(user));
             finalizeLoginState(isLoginSuccess);
        }
    } else {
        chatContainer.classList.add('hidden');
        sidebar.classList.add('hidden');
        showLoginForm(); 
        
        if (isLoginSuccess) {
            loginStatus.textContent = '';
        } else if (!loginStatus.textContent.includes('Error') && !loginStatus.textContent.includes('Logged out')) {
        }
    }
}

function finalizeLoginState(wasLoginAction = false) {
    loginContainer.classList.add('hidden');
    registerContainer.classList.add('hidden'); 
    chatContainer.classList.remove('hidden');
    sidebar.classList.remove('hidden');
    currentUsernameSpan.textContent = currentUsername;
    if (wasLoginAction) {
        loginStatus.textContent = '';
        registerStatus.textContent = ''; 
    }
    
    connectWebSocket();
    emojiPicker.classList.add('hidden');
    isPickerOpen = false;
}

function logoutUser() {
    jwtToken = null;
    currentUserId = null;
    currentUsername = null;
    selectedChatId = null;
    chatCache = {};
    userCache = {};
    localStorage.removeItem('chatToken');
    disconnectWebSocket();
    
    chatListUl.innerHTML = '';
    messagesDiv.innerHTML = '<p>Please login.</p>';
    chatHeader.innerHTML = ''; 
    currentUsernameSpan.textContent = '';
    messageForm.classList.add('hidden');
    
    chatContainer.classList.add('hidden');
    sidebar.classList.add('hidden');
    showLoginForm(); 
    
    loginStatus.textContent = 'Logged out.';
    emojiPicker.classList.add('hidden');
    isPickerOpen = false;
}


const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', 
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🧐',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕',
    '💞', '💓', '💗', '💖', '💘', '💝', '💟', '👍', '👎', '👌',
    '✌️', '🤞', '🤘', '🤙', '👋', '👏', '🙌', '🙏', '🎉', '🎊'
];

function populateEmojiPicker() {
    emojiPicker.innerHTML = '';
    
    const gridContainer = document.createElement('div');
    gridContainer.className = 'emoji-grid';
    
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.addEventListener('click', (e) => {
            e.stopPropagation(); 
            insertEmoji(emoji);
            emojiPicker.classList.add('hidden');
            isPickerOpen = false;
        });
        gridContainer.appendChild(span);
    });
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '✖';
    closeButton.className = 'emoji-close-btn';
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.classList.add('hidden');
        isPickerOpen = false;
    });
    
    emojiPicker.appendChild(closeButton);
    emojiPicker.appendChild(gridContainer);
}

function insertEmoji(emoji) {
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const text = messageInput.value;
    messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    messageInput.focus();
    messageInput.setSelectionRange(start + emoji.length, start + emoji.length);
}

function toggleEmojiPicker(event) {
    if (event) {
        event.stopPropagation();
    }
    
    if (isPickerOpen) {
        emojiPicker.classList.add('hidden');
    } else {
        populateEmojiPicker();
        emojiPicker.classList.remove('hidden');
    }
    isPickerOpen = !isPickerOpen;
}

emojiButton.addEventListener('click', toggleEmojiPicker);

document.addEventListener('click', function(event) {
    if (isPickerOpen && !emojiButton.contains(event.target) && !emojiPicker.contains(event.target)) {
        emojiPicker.classList.add('hidden');
        isPickerOpen = false;
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginStatus.textContent = '';
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    loginUser(email, password);
});

disconnectButton.addEventListener('click', () => {
    logoutUser();
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    if (message && selectedChatId) {
        sendMessage(selectedChatId, message);
    }
});

updateLoginState();

function updateUserStatusIndicator(userId) {
    if (!userId) {
        console.error('Cannot update status for undefined userId');
        return;
    }
    
    const status = userStatuses.get(userId) || 'offline';
    console.log(`Updating status for user ${userId} to ${status}`);
    
    Object.entries(chatCache).forEach(([chatId, chat]) => {
        if (chat.type === 'direct' && chat.otherParticipant && chat.otherParticipant.id === userId) {
            const chatElement = document.querySelector(`#chat-list li[data-chat-id="${chatId}"]`);
            if (chatElement) {
                console.log(`Found chat element for user ${userId}`);
                
                console.log('Chat Element:', chatElement.outerHTML);
                
                chatElement.classList.remove('status-online', 'status-away', 'status-offline');
                
                chatElement.classList.add(`status-${status}`);
                console.log(`Added status class: status-${status}`);
                
                let statusIndicator = chatElement.querySelector('.status-indicator');
                console.log('Existing status indicator:', statusIndicator);
                
                if (!statusIndicator) {
                    statusIndicator = document.createElement('span');
                    statusIndicator.className = 'status-indicator';
                    chatElement.appendChild(statusIndicator);
                    console.log('Created new status indicator');
                }
                
                statusIndicator.style.display = 'inline-block';
                statusIndicator.setAttribute('title', `${status.charAt(0).toUpperCase() + status.slice(1)}`);
            } else {
                console.warn(`Chat element not found for chat ID ${chatId}`);
            }
        }
    });
    
    if (selectedChatId && chatCache[selectedChatId] && 
        chatCache[selectedChatId].type === 'direct' && 
        chatCache[selectedChatId].otherParticipant &&
        chatCache[selectedChatId].otherParticipant.id === userId) {
        
        let headerStatus = document.getElementById('chat-header-status');
        if (!headerStatus) {
            headerStatus = document.createElement('span');
            headerStatus.id = 'chat-header-status';
            chatHeader.appendChild(headerStatus);
        }
        
        headerStatus.textContent = ` (${status})`;
        headerStatus.className = `status-${status}`;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('visible');
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

function disconnectWebSocket() {
    if (websocket) {
        websocket.close(1000, 'User initiated disconnect');
    }
}

function sendReadReceipt(chatId, messageId) {
    console.log('Sending read receipt for message:', messageId);
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        return;
    }
    
    const chat = chatCache[chatId];
    if (!chat || !chat.participants) {
        return;
    }
    
    const message = {
        type: WS_MESSAGE_TYPES.READ_RECEIPT,
        payload: {
            chatId,
            messageId,
            participantIds: chat.participants
        }
    };
    
    console.log('Sending message to WebSocket:', message);
    websocket.send(JSON.stringify(message));
}

function handleImageAttachment() {
    imageUploadInput.click();
}

function handleImageSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('Image size should be less than 10MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearImagePreview() {
    imagePreviewContainer.classList.add('hidden');
    imagePreview.src = '';
    imageUploadInput.value = '';
}


function closeLightbox() {
    if (!isLightboxOpen) return; 
    
    const lightbox = document.querySelector('.lightbox');
    if (lightbox) {
        document.body.removeChild(lightbox);
        isLightboxOpen = false;
        
        document.removeEventListener('keydown', handleLightboxKeyDown);
        console.log("Lightbox closed");
    }
}


function handleLightboxKeyDown(event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
}


function openLightbox(imageUrl) {
    if (isLightboxOpen) {
        console.log("Lightbox already open, skipping.");
        return; 
    }
    
    console.log("Opening lightbox for:", imageUrl);
    isLightboxOpen = true; 
    
    const lightbox = document.createElement('div');
    lightbox.classList.add('lightbox');
    
    const img = document.createElement('img');
    img.src = imageUrl;
    
    const closeButton = document.createElement('span');
    closeButton.classList.add('lightbox-close');
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', closeLightbox);
    
    lightbox.appendChild(img);
    lightbox.appendChild(closeButton);
    document.body.appendChild(lightbox);
    
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    document.addEventListener('keydown', handleLightboxKeyDown);
}

document.addEventListener('DOMContentLoaded', function() {
    
    if (attachImageButton) {
        attachImageButton.addEventListener('click', handleImageAttachment);
    }
    
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', handleImageSelection);
    }
    
    if (removeImageButton) {
        removeImageButton.addEventListener('click', clearImagePreview);
    }
    
    if (messageForm) {
        messageForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const content = messageInput.value.trim();
            
            if (!selectedChatId) return;
            
            if (!imagePreviewContainer.classList.contains('hidden')) {
                const imageFile = imageUploadInput.files[0];
                if (imageFile) {
                    try {
                        const submitButton = messageForm.querySelector('button[type="submit"]');
                        if (submitButton) submitButton.disabled = true;
                        const uploadResult = await uploadImage(imageFile);
                        if (uploadResult && uploadResult.url) {
                            await sendMessage(selectedChatId, content || 'Image sent', uploadResult.url);
                        } else {
                            alert('Image upload failed, message not sent.');
                        }
                    } catch (error) {
                        console.error('Failed to upload image:', error);
                        alert('Failed to upload image. Please try again.');
                    } finally {
                        const submitButton = messageForm.querySelector('button[type="submit"]');
                        if (submitButton) submitButton.disabled = false;
                    }
                }
            } else if (content) {
                await sendMessage(selectedChatId, content);
            }
             messageInput.value = '';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loginStatus.textContent = '';
            const email = loginEmailInput.value; 
            const password = loginPasswordInput.value; 
            loginUser(email, password);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            registerStatus.textContent = '';
            const username = registerUsernameInput.value;
            const displayName = registerDisplayNameInput.value;
            const email = registerEmailInput.value;
            const password = registerPasswordInput.value;
            registerUser(username, displayName, email, password);
        });
    }
    
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    }
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm(); 
        });
    }
    
  
    if (startChatBtn) {
        startChatBtn.addEventListener('click', () => {
            showNewChatModal();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            hideNewChatModal();
        });
    }
    
    if (cancelChatBtn) {
        cancelChatBtn.addEventListener('click', () => {
            hideNewChatModal();
        });
    }
    
    if (createChatBtn) {
        createChatBtn.addEventListener('click', () => {
            createNewChat();
        });
    }
    
    if (usernameSearchInput) {
        usernameSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            searchTimeout = setTimeout(() => {
                searchUsers(query);
            }, 500);
        });
        
        usernameSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = e.target.value.trim();
                searchUsers(query);
            }
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === newChatModal) {
            hideNewChatModal();
        }
    });

    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            avatarUploadInput.click(); 
        });
    }
    
    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                avatarUploadStatus.textContent = 'Please select an image file.';
                return;
            }
            if (file.size > 15 * 1024 * 1024) { 
                avatarUploadStatus.textContent = 'Image size should be less than 15MB.';
                return;
            }
            
            await uploadAvatar(file);
            
            avatarUploadInput.value = '';
        });
    }

    updateLoginState();
});

function showNewChatModal() {
    newChatModal.classList.remove('hidden');
    newChatModal.classList.add('visible');
    usernameSearchInput.focus();
    searchResultsDiv.innerHTML = '';
    searchStatusText.textContent = '';
    selectedUserId = null;
    createChatBtn.disabled = true;
}

function hideNewChatModal() {
    newChatModal.classList.remove('visible');
    setTimeout(() => {
        newChatModal.classList.add('hidden');
    }, 300);
    usernameSearchInput.value = '';
}

async function searchUsers(query) {
    if (!query || query.trim().length < 3) {
        searchStatusText.textContent = 'Please enter at least 3 characters';
        searchResultsDiv.innerHTML = '';
        return;
    }

    searchStatusText.textContent = 'Searching...';
    
    try {
        const users = await fetchApi(`/users/search?q=${encodeURIComponent(query)}`);
        
        if (!users || users.length === 0) {
            searchStatusText.textContent = 'No users found';
            searchResultsDiv.innerHTML = '';
            return;
        }
        
        const filteredUsers = users.filter(user => user.id !== currentUserId);
        
        if (filteredUsers.length === 0) {
            searchStatusText.textContent = 'No other users found';
            searchResultsDiv.innerHTML = '';
            return;
        }
        
        searchStatusText.textContent = `Found ${filteredUsers.length} user(s)`;
        displaySearchResults(filteredUsers);
    } catch (error) {
        console.error('Error searching users:', error);
        searchStatusText.textContent = 'Error searching users';
    }
}

function displaySearchResults(users) {
    searchResultsDiv.innerHTML = '';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-result';
        userDiv.dataset.userId = user.id;
        
        userDiv.innerHTML = `
            <strong>@${user.username}</strong>
            <div>${user.displayName || ''}</div>
        `;
        
        userDiv.addEventListener('click', () => {
            document.querySelectorAll('.user-result').forEach(el => {
                el.classList.remove('selected');
            });
            
            userDiv.classList.add('selected');
            selectedUserId = user.id;
            createChatBtn.disabled = false;
        });
        
        searchResultsDiv.appendChild(userDiv);
    });
}

async function createNewChat() {
    if (!selectedUserId) {
        searchStatusText.textContent = 'Please select a user';
        return;
    }
    
    if (selectedUserId === currentUserId) {
        searchStatusText.textContent = 'You cannot start a chat with yourself';
        return;
    }
    
    searchStatusText.textContent = 'Creating chat...';
    createChatBtn.disabled = true;
    
    try {
        const existingChats = await fetchApi('/chats');
        
        if (existingChats && existingChats.length > 0) {
            const existingChat = existingChats.find(chat => 
                chat.type === 'direct' && 
                chat.participants.includes(selectedUserId) &&
                chat.participants.length === 2
            );
            
            if (existingChat) {
                hideNewChatModal();
                selectChat(existingChat.id);
                return;
            }
        }
        
        const chatData = {
            type: 'direct',
            participants: [selectedUserId]
        };
        
        const newChat = await fetchApi('/chats', {
            method: 'POST',
            body: JSON.stringify(chatData)
        });
        
        if (newChat && newChat.id) {
            await fetchChats();
            
            hideNewChatModal();
            selectChat(newChat.id);
        } else {
            searchStatusText.textContent = 'Failed to create chat';
        }
    } catch (error) {
        console.error('Error creating chat:', error);
        searchStatusText.textContent = 'Error creating chat';
    } finally {
        createChatBtn.disabled = false;
    }
}

async function uploadAvatar(file) {
    avatarUploadStatus.textContent = 'Uploading...';
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/v1/users/profile/avatar', {
            method: 'PUT', 
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            },
            body: formData
        });

        const textData = await response.text();
        let data;
        
        try {
            data = JSON.parse(textData);
        } catch (parseError) {
            console.error('Server response is not valid JSON:', textData.substring(0, 100));
            throw new Error('Could not process server response. API endpoint might not exist or is not working.');
        }

        if (!response.ok) {
            throw new Error(data.message || 'Avatar upload failed');
        }

        avatarUploadStatus.textContent = 'Avatar updated!';
        updateCurrentUserProfile(data.user); 
        
        setTimeout(() => { avatarUploadStatus.textContent = ''; }, 3000);
        return true;
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        avatarUploadStatus.textContent = `Error: ${error.message}`;
        return false;
    }
}

function updateCurrentUserProfile(user) {
    if (user) {
        currentUsername = user.username;
        currentUsernameSpan.textContent = currentUsername;
        displayAvatar(userAvatarDiv, user.profileImage, user.username);
    } else {
        console.error("Cannot update profile, user data is missing.");
    }
}

function displayAvatar(container, imageUrl, username) {
    container.innerHTML = ''; 
    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = username;
        container.appendChild(img);
        
        container.addEventListener('click', () => openLightbox(imageUrl));
    } else {
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'avatar-placeholder';
        placeholderDiv.textContent = username.charAt(0).toUpperCase();
        container.appendChild(placeholderDiv);
    }
} 