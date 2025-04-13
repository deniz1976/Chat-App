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
const chatHeader = document.getElementById('chat-header').querySelector('h2');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');

let jwtToken = localStorage.getItem('chatToken');
let websocket = null;
let currentUserId = null;
let currentUsername = null;
let selectedChatId = null;
let chatCache = {};
let userCache = {};
let isPickerOpen = false;
let userStatuses = new Map(); 

const API_BASE_URL = '/api/v1';
const WS_BASE_URL = `ws://${window.location.host}`;

async function fetchApi(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    if (jwtToken) {
        defaultHeaders['Authorization'] = `Bearer ${jwtToken}`;
    }
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
        throw new Error(data?.message || `API Error: ${response.status}`);
    }
    return data;
}

async function loginUser(email, password) {
    loginStatus.textContent = 'Logging in...';
    try {
        const data = await fetchApi('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        jwtToken = data.token;
        currentUserId = data.user.id;
        currentUsername = data.user.displayName;
        localStorage.setItem('chatToken', jwtToken);
        updateLoginState(true);
    } catch (error) {
        console.error('Login error:', error);
        loginStatus.textContent = `Error: ${error.message}`;
        logoutUser();
    }
}

async function fetchChats() {
    if (!jwtToken) return;
    try {
        const chats = await fetchApi('/chats');
        displayChatList(chats);
    } catch (error) {
        console.error('Error fetching chats:', error);
        chatListUl.innerHTML = '<li>Error loading chats</li>';
    }
}

async function fetchMessages(chatId) {
    messagesDiv.innerHTML = '<p>Loading messages...</p>';
    try {
        const messages = await fetchApi(`/messages/chat/${chatId}?limit=100`);
        messagesDiv.innerHTML = '';
        messages.forEach(displayMessage);
        scrollToBottom();
    } catch (error) {
        console.error(`Error fetching messages for chat ${chatId}:`, error);
        messagesDiv.innerHTML = '<p>Error loading messages.</p>';
    }
}

async function sendMessage(chatId, content) {
    if (!jwtToken || !chatId || !content.trim()) {
        return;
    }
    try {
        const tempMessage = {
            id: 'temp-' + Date.now(),
            senderId: currentUserId,
            sender: { displayName: currentUsername },
            chatId: chatId,
            content: content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        displayMessage(tempMessage);
        
        updateChatListPreview(chatId, tempMessage);
        
        messageInput.value = '';
        
        await fetchApi('/messages', {
            method: 'POST',
            body: JSON.stringify({ chatId, content }),
        });
        

    } catch (error) {
        console.error('Send message error:', error);
        alert(`Error sending message: ${error.message}`);
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
    if (payload.chatId === selectedChatId) {
        displayMessage(payload);
        
        if (typeof sendReadReceipt === 'function') {
            sendReadReceipt(payload.chatId, payload.id);
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
            showNotification(`${userCache[userId].displayName} is now online`);
        }
    } else {
        fetchUserInfo(userId).then(user => {
            if (user) {
                updateUserStatusIndicator(userId);
                
                if (status === 'online' && oldStatus !== 'online' && userId !== currentUserId) {
                    showNotification(`${user.displayName} is now online`);
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
    
    console.log('Displaying message:', message);
    
    const msgElement = document.createElement('p');
    msgElement.setAttribute('data-message-id', message.id);
    const senderName = message.sender?.displayName || 'Unknown User';
    const isSender = message.senderId === currentUserId;

    const contentSpan = document.createElement('span');
    contentSpan.innerHTML = `${!isSender ? `<strong>${senderName}:</strong> ` : ''}${message.content}`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
    
    if (isSender) {
        const readStatus = document.createElement('span');
        readStatus.className = 'read-status';
        readStatus.textContent = '✓'; 
        msgElement.appendChild(readStatus);
    }

    msgElement.appendChild(contentSpan);
    msgElement.appendChild(timeSpan);
    msgElement.classList.add(isSender ? 'sent' : 'received');
    
    if (!isSender && selectedChatId === message.chatId) {
        if (typeof sendReadReceipt === 'function') {
            sendReadReceipt(message.chatId, message.id);
        }
    }
    
    messagesDiv.appendChild(msgElement);
    scrollToBottom();
}

async function displayChatList(chats) {
    chatListUl.innerHTML = '';
    chatCache = {};
    userCache = {};
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
        if (chat.type === 'direct' && chat.participants) {
            const otherUserId = chat.participants.find(id => id !== currentUserId);
            if (otherUserId) {
                otherParticipant = await fetchUserInfo(otherUserId);
                chatName = otherParticipant?.displayName || 'Direct Chat';
                chatCache[chat.id].otherParticipant = otherParticipant;
                
                if (otherParticipant.id) {
                    const userStatus = userStatuses.get(otherParticipant.id) || 'offline';
                    li.classList.add(`status-${userStatus}`);
                }
            }
        }
        chatName = chatName || 'Unnamed Chat';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-name';
        nameSpan.textContent = chatName;
        const lastMsgSpan = document.createElement('span');
        lastMsgSpan.className = 'chat-last-message';
        lastMsgSpan.textContent = chat.lastMessage?.content || 'No messages yet';
        lastMsgSpan.id = `last-msg-${chat.id}`;
        li.appendChild(nameSpan);
        li.appendChild(lastMsgSpan);
        
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
    let headerTitle = 'Chat';
    if (selectedChat) {
        if (selectedChat.type === 'group') {
            headerTitle = selectedChat.name || 'Group Chat';
        } else if (selectedChat.otherParticipant) {
            headerTitle = selectedChat.otherParticipant.displayName || 'Direct Chat';
            
            // If this is a direct chat, update the user status in the header
            if (selectedChat.otherParticipant.id) {
                updateUserStatusIndicator(selectedChat.otherParticipant.id);
            }
        } else {
            headerTitle = 'Direct Chat';
        }
    }
    chatHeader.textContent = headerTitle;
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
                        currentUsername = user.displayName;
                        loginStatus.textContent = '';
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
            finalizeLoginState(isLoginSuccess);
        }
    } else {
        loginContainer.classList.remove('hidden');
        chatContainer.classList.add('hidden');
        sidebar.classList.add('hidden');
        if (isLoginSuccess) {
            loginStatus.textContent = '';
        } else if (!loginStatus.textContent.includes('Error') && !loginStatus.textContent.includes('Logged out')) {
            loginStatus.textContent = 'Please login.';
        }
    }
}

function finalizeLoginState(wasLoginAction = false) {
    loginContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    sidebar.classList.remove('hidden');
    currentUsernameSpan.textContent = currentUsername;
    if (wasLoginAction) loginStatus.textContent = '';
    
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
    
    // Clear UI elements explicitly
    chatListUl.innerHTML = '';
    messagesDiv.innerHTML = '<p>Please login.</p>';
    chatHeader.textContent = 'Select a Chat';
    currentUsernameSpan.textContent = '';
    messageForm.classList.add('hidden');
    
    updateLoginState();
    loginStatus.textContent = 'Logged out.';
    emojiPicker.classList.add('hidden');
    isPickerOpen = false;
}

// --- Emoji Picker Logic ---
// Extended list with more emojis
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
    
    // Grid organized with categories/page markers
    const gridContainer = document.createElement('div');
    gridContainer.className = 'emoji-grid';
    
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.addEventListener('click', (e) => {
            e.stopPropagation(); // Extra event protection
            insertEmoji(emoji);
            emojiPicker.classList.add('hidden');
            isPickerOpen = false;
        });
        gridContainer.appendChild(span);
    });
    
    // Add close button
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

// Emoji button click event update
emojiButton.addEventListener('click', toggleEmojiPicker);

// Outside click event already exists, but let's strengthen it
document.addEventListener('click', function(event) {
    // Close if clicked outside emoji button and picker
    if (isPickerOpen && !emojiButton.contains(event.target) && !emojiPicker.contains(event.target)) {
        emojiPicker.classList.add('hidden');
        isPickerOpen = false;
    }
});

// --- Event Listeners ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginStatus.textContent = '';
    const email = emailInput.value;
    const password = passwordInput.value;
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

// --- Initial Check ---
updateLoginState();

// --- Enhanced UI Functions ---
function updateUserStatusIndicator(userId) {
    if (!userId) {
        console.error('Cannot update status for undefined userId');
        return;
    }
    
    const status = userStatuses.get(userId) || 'offline';
    console.log(`Updating status for user ${userId} to ${status}`);
    
    // Find all chat list items that represent direct chats with this user
    Object.entries(chatCache).forEach(([chatId, chat]) => {
        if (chat.type === 'direct' && chat.otherParticipant && chat.otherParticipant.id === userId) {
            const chatElement = document.querySelector(`#chat-list li[data-chat-id="${chatId}"]`);
            if (chatElement) {
                console.log(`Found chat element for user ${userId}`);
                
                // Debug what the element looks like
                console.log('Chat Element:', chatElement.outerHTML);
                
                // Remove any existing status classes
                chatElement.classList.remove('status-online', 'status-away', 'status-offline');
                
                // Add new status class
                chatElement.classList.add(`status-${status}`);
                console.log(`Added status class: status-${status}`);
                
                // Check if status indicator already exists
                let statusIndicator = chatElement.querySelector('.status-indicator');
                console.log('Existing status indicator:', statusIndicator);
                
                // Create if it doesn't exist
                if (!statusIndicator) {
                    statusIndicator = document.createElement('span');
                    statusIndicator.className = 'status-indicator';
                    chatElement.appendChild(statusIndicator);
                    console.log('Created new status indicator');
                }
                
                // Make sure it's visible and has the right title
                statusIndicator.style.display = 'inline-block';
                statusIndicator.setAttribute('title', `${status.charAt(0).toUpperCase() + status.slice(1)}`);
            } else {
                console.warn(`Chat element not found for chat ID ${chatId}`);
            }
        }
    });
    
    // If this user is the current chat header, update the header status too
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

// Helper function to show a temporary notification
function showNotification(message) {
    // Create a notification element
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    
    // Add it to the body
    document.body.appendChild(notification);
    
    // Make it visible
    setTimeout(() => {
        notification.classList.add('visible');
    }, 10);
    
    // Remove it after a delay
    setTimeout(() => {
        notification.classList.remove('visible');
        
        // After fade out animation, remove from DOM
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

// --- Read Receipt Logic ---
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