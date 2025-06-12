const WebSocket = require('ws');
const express = require('express');
const path = require('path');

// הגדרות בסיסיות
const PORT = process.env.PORT || 3000;
const app = express();

// הגשת קבצים סטטיים מהתיקייה הנוכחית
app.use(express.static('.'));

// נתיב דף בית פשוט עם קישורים
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
            <h1>🎓 ClassroomSDK Chat Server</h1>
            <h2>השרת פועל בהצלחה!</h2>
            
            <div style="margin: 30px 0;">
                <a href="/teacher-dashboard.html" style="background: #2196F3; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; margin: 10px;">
                    👨‍🏫 לוח מורה
                </a>
                <a href="/math-game-example.html" style="background: #4CAF50; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; margin: 10px;">
                    🎮 דוגמת משחק
                </a>
            </div>
            
            <p>שרת WebSocket פועל על פורט ${PORT}</p>
        </div>
    `);
});

// יצירת שרת HTTP
const server = app.listen(PORT, () => {
    console.log(`🚀 ClassroomSDK Server running on port ${PORT}`);
});

// יצירת שרת WebSocket המאזין על שרת ה-HTTP
const wss = new WebSocket.Server({ server });

// מאגרים בזיכרון לניהול חדרים ומשתמשים
const rooms = new Map();
const users = new Map();

// --- פונקציות עזר ---

function getRoom(roomCode) {
    if (!rooms.has(roomCode)) {
        rooms.set(roomCode, {
            code: roomCode,
            users: new Set(),
            createdAt: new Date()
        });
        console.log(`🏠 Room created: ${roomCode}`);
    }
    return rooms.get(roomCode);
}

function addUserToRoom(socket, roomCode, userName) {
    const room = getRoom(roomCode);
    room.users.add(userName);
    
    users.set(socket, {
        name: userName,
        roomCode: roomCode
    });
    
    console.log(`👤 ${userName} joined room ${roomCode} (${room.users.size} users total)`);
    return room;
}

function removeUserFromRoom(socket) {
    const user = users.get(socket);
    if (user) {
        const room = getRoom(user.roomCode);
        room.users.delete(user.name);
        users.delete(socket);
        console.log(`👋 ${user.name} left room ${user.roomCode} (${room.users.size} users remaining)`);
        return { user, room };
    }
    return null;
}

function broadcastToRoom(roomCode, message, excludeSocket = null) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    let sentCount = 0;
    for (const [socket, user] of users.entries()) {
        if (user.roomCode === roomCode && socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
            sentCount++;
        }
    }
}

// --- טיפול בחיבורי WebSocket ---

wss.on('connection', (socket) => {
    console.log('🔌 New WebSocket connection');
    
    socket.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📨 Received:', message.type, 'from', message.playerName || message.sender || 'Unknown');
            
            // המוח של השרת: טיפול בהודעות לפי סוג
            switch (message.type) {
                case 'joinRoom':
                case 'join': // תמיכה בשני הפורמטים
                    handleJoinRoom(socket, message);
                    break;
                    
                case 'message':
                    handleMessage(socket, message);
                    break;

                case 'aiConfig':
                    const user = users.get(socket);
                    if (user && user.name === 'מורה') {
                        broadcastToRoom(user.roomCode, message, socket);
                        console.log(`⚙️  AI config of type '${message.modelId}' sent by teacher to room ${user.roomCode}`);
                    }
                    break;
                    
                default:
                    console.log('❓ Received unknown message type:', message.type);
            }
            
        } catch (error) {
            console.error('❌ Error parsing message:', error);
        }
    });
    
    socket.on('close', () => handleDisconnect(socket));
    socket.on('error', (error) => console.error('❌ WebSocket error:', error));
});


// --- מטפלי הודעות ---

function handleJoinRoom(socket, message) {
    const roomCode = message.roomCode || '0000';
    const userName = message.playerName || message.name || 'אנונימי';
    const room = addUserToRoom(socket, roomCode, userName);
    
    socket.send(JSON.stringify({ type: 'joinedRoom', roomCode, userName, usersInRoom: Array.from(room.users) }));
    
    broadcastToRoom(roomCode, { type: 'studentJoined', playerName: userName }, socket);
    broadcastToRoom(roomCode, { type: 'roomUpdate', roomCode, userCount: room.users.size, users: Array.from(room.users) });
}

function handleMessage(socket, message) {
    const user = users.get(socket);
    if (!user) return;
    
    const messageData = { ...message, sender: user.name, name: user.name, timestamp: new Date().toISOString() };
    broadcastToRoom(user.roomCode, messageData);
}

function handleDisconnect(socket) {
    const result = removeUserFromRoom(socket);
    if (result) {
        const { user, room } = result;
        broadcastToRoom(user.roomCode, { type: 'studentLeft', playerName: user.name });
        broadcastToRoom(user.roomCode, { type: 'roomUpdate', userCount: room.users.size, users: Array.from(room.users) });

        if (room.users.size === 0) {
            rooms.delete(user.roomCode);
            console.log(`🏠 Room ${user.roomCode} deleted (empty)`);
        }
    }
    console.log('🔌 WebSocket disconnected');
}

console.log('✅ ClassroomSDK Chat Server is ready!');