// server.js - Full Updated Version

const WebSocket = require('ws');
const express = require('express');
const path = require('path');

// --- Basic Setup ---
const PORT = process.env.PORT || 3000;
const app = express();

// Serve static files from the current directory
app.use(express.static('.'));

// A simple homepage with links
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
            <h1>🎓 ClassroomSDK Chat Server</h1>
            <h2>השרת פועל בהצלחה!</h2>
            
            <div style="margin: 30px 0;">
                <a href="/teacher-dashboard.html" style="background: #2196F3; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; margin: 10px;">
                    👨‍🏫 לוח מורה
                </a>
                <a href="/student-app.html" style="background: #4CAF50; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; margin: 10px;">
                    👨‍🎓 אפליקציית תלמיד
                </a>
            </div>
            
            <p>שרת WebSocket פועל על פורט ${PORT}</p>
        </div>
    `);
});

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`🚀 ClassroomSDK Server running on port ${PORT}`);
});

// Create WebSocket server that listens on the HTTP server
const wss = new WebSocket.Server({ server });


// --- In-memory storage for rooms and users ---
const rooms = new Map();
const users = new Map();


// --- Helper Functions ---

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
    
    for (const [socket, user] of users.entries()) {
        if (user.roomCode === roomCode && socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }
}


// --- WebSocket Connection Handling ---
wss.on('connection', (socket) => {
   console.log('🔌 New WebSocket connection');
   
   socket.on('message', (data) => {
       try {
           const message = JSON.parse(data);
           console.log('📨 Received:', message.type, 'from', message.playerName || 'Unknown');
           
           switch (message.type) {
               case 'join':
                   handleJoinRoom(socket, message);
                   break;
                   
               case 'message':
                   handleMessage(socket, message);
                   break;
               
               case 'command':
                   handleCommand(socket, message);
                   break;
                   
               default:
                   console.log('❓ Received unknown message type:', message.type);
                   socket.send(JSON.stringify({
                       type: 'error',
                       code: 'UNKNOWN_MESSAGE_TYPE',
                       message: `The server does not recognize message type: ${message.type}`
                   }));
           }
           
       } catch (error) {
           console.error('❌ Error parsing message:', error);
       }
   });
   
   socket.on('close', () => handleDisconnect(socket));
   socket.on('error', (error) => console.error('❌ WebSocket error:', error));
});


// --- Message Handlers ---

function handleJoinRoom(socket, message) {
    const roomCode = message.roomCode || '0000';
    const userName = message.playerName || 'אנונימי';
    const room = addUserToRoom(socket, roomCode, userName);
    
    socket.send(JSON.stringify({ type: 'joinedRoom', roomCode, userName, usersInRoom: Array.from(room.users) }));
    broadcastToRoom(roomCode, { type: 'studentJoined', playerName: userName }, socket);
    broadcastToRoom(roomCode, { type: 'roomUpdate', roomCode, userCount: room.users.size, users: Array.from(room.users) });
}

function handleMessage(socket, message) {
    const user = users.get(socket);
    if (!user) return;
    const messageData = { ...message, sender: user.name, timestamp: new Date().toISOString() };
    
    if (message.target) {
        let foundTarget = false;
        for (const [targetSocket, targetUser] of users.entries()) {
            if (targetUser.roomCode === user.roomCode && targetUser.name === message.target) {
                targetSocket.send(JSON.stringify(messageData));
                foundTarget = true;
                break; 
            }
        }
    } else {
        broadcastToRoom(user.roomCode, messageData, socket);
    }
}

function handleCommand(socket, message) {
    const user = users.get(socket);
    if (!user) return;
    
    const commandData = { ...message, sender: user.name, timestamp: new Date().toISOString() };

    switch (message.command) {
        case 'LOAD_CONTENT':
        case 'SETUP_AI':
            console.log(`Broadcasting command '${message.command}' from ${user.name}`);
            broadcastToRoom(user.roomCode, commandData, socket);
            break;
            
        default:
            console.log(`❓ Received unknown command: ${message.command}`);
            socket.send(JSON.stringify({
                type: 'error',
                code: 'UNKNOWN_COMMAND',
                message: `The server does not recognize the command: ${message.command}`
            }));
    }
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