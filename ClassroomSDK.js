class ClassroomSDK {
    constructor(serverUrl = 'wss://classroom-server-aka9.onrender.com') {
		    console.log("🔍 Actual server URL being used:", serverUrl); 
        this.serverUrl = serverUrl;
        this.gameConnection = {
            ws: null,
            isConnected: false,
            playerName: '',
            roomCode: '0000'
        };
        this.chatContainer = null;
        this.aiContainer = null;
        this.chatButton = null;
        this.aiButton = null;
        this.unreadCount = 0;
        
        this.aiConfig = {
            isReady: false,
            model: null,
            apiKey: null,
            hfToken: null,
            modelName: 'לא הופעל'
        };
        
        this.availableModels = {
            'deepseek-math': {
                name: 'DeepSeek-Math (מתמטיקה)',
                endpoint: 'https://api-inference.huggingface.co/models/deepseek-ai/deepseek-math-7b-instruct',
                type: 'huggingface',
                icon: '🔢'
            },
            'gemini': {
                name: 'Gemini (כללי וחזק)',
                endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
                type: 'gemini',
                icon: '🤖'
            },
            'flan-t5': {
                name: 'Flan-T5 (חינוכי)',
                endpoint: 'https://api-inference.huggingface.co/models/google/flan-t5-large',
                type: 'huggingface',
                icon: '📚'
            },
            'dialogpt': {
                name: 'DialoGPT (שיחה)',
                endpoint: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
                type: 'huggingface',
                icon: '💬'
            }
        };
        
        this.debugEnabled = false;
    }

    async init(containerId, playerName = null) {
        this.gameConnection.playerName = playerName || this.generatePlayerName();
        await this.connectToServer();
        return this;
    }

    generatePlayerName() {
        const names = ['דני', 'מיכל', 'יוסי', 'רחל', 'אבי', 'שרה', 'עומר', 'טליה'];
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomNum = Math.floor(Math.random() * 100);
        return `${randomName}${randomNum}`;
    }

    async connectToServer() {
        if (this.gameConnection.isConnected) return;
        try {
            this.gameConnection.ws = new WebSocket(this.serverUrl);
            this.gameConnection.ws.onopen = () => {
                this.gameConnection.isConnected = true;
                this.updateConnectionStatus();
                this.joinRoom();
            };
            this.gameConnection.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
            this.gameConnection.ws.onclose = () => {
                this.gameConnection.isConnected = false;
                this.updateConnectionStatus();
            };
            this.gameConnection.ws.onerror = () => {
                this.gameConnection.isConnected = false;
                this.updateConnectionStatus();
            };
        } catch (error) {
            this.gameConnection.isConnected = false;
            this.updateConnectionStatus();
        }
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = this.gameConnection.isConnected ? `🟢 מחובר כ-${this.gameConnection.playerName}` : '🔴 לא מחובר';
            statusElement.className = `connection-status ${this.gameConnection.isConnected ? 'connected' : 'disconnected'}`;
        }
    }

    joinRoom() {
        if (this.gameConnection.isConnected) {
            this.gameConnection.ws.send(JSON.stringify({ type: 'joinRoom', roomCode: this.gameConnection.roomCode, playerName: this.gameConnection.playerName }));
        }
    }

    handleMessage(message) {
        // הדפסה מפורטת של כל הודעה
        console.log("%c=== STUDENT-SIDE: New Message Received ===", "color: blue; font-weight: bold; font-size: 14px;");
        console.log("Message type:", message.type);
        console.log("Full message object:", message);
        
        switch (message.type) {
            case 'message':
                console.log("📩 Regular message from:", message.sender);
                if (message.sender !== this.gameConnection.playerName) {
                    this.displayChatMessage(message);
                    this.showNewMessageNotification(message);
                }
                break;
                
			case 'aiConfig':
				const user = users.get(socket);
				console.log("?? AI Config received from:", user ? user.name : "unknown");
				if (user) {
					console.log("?? Broadcasting AI config to room:", user.roomCode);
					broadcastToRoom(user.roomCode, message, socket);
					console.log('?? AI config sent to room', user.roomCode);
				}
				break;
                
                console.log("�?Model found, processing AI config...");
                this.handleAIConfig(message);
                break;
            
            case 'joinedRoom':
                console.log("🏠 Joined room:", message.roomCode);
                break;
                
            case 'roomUpdate':
                console.log("📊 Room update - users:", message.users);
                break;
                
            case 'studentJoined':
                console.log("👋 Student joined:", message.playerName);
                break;
                
            case 'studentLeft':
                console.log("👋 Student left:", message.playerName);
                break;

            default:
                console.warn("�?Unknown message type:", message.type);
                console.log("Full unknown message:", message);
        }
    }

    handleAIConfig(message) {
        const { modelId, apiKey, hfToken } = message;
        if (!this.availableModels[modelId]) return;

        this.aiConfig = { 
            isReady: true, 
            model: modelId, 
            apiKey: apiKey || null, 
            hfToken: hfToken || null, 
            modelName: this.availableModels[modelId].name 
        };
        
        console.log("�?AI Config updated:", this.aiConfig);
        
        this.showAIConfigNotification(modelId);
        this.updateAIButton();
        if (this.aiContainer && this.aiContainer.style.display !== 'none') {
            this.updateAIInterface();
        }
    }

    showAIConfigNotification(modelId) {
        const modelInfo = this.availableModels[modelId];
        // יצירת התראה קופצת
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            padding: 20px 30px;
            border-radius: 15px;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 10000;
            direction: rtl;
            font-family: Arial, sans-serif;
        `;
        
        notification.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 10px;">${modelInfo.icon}</div>
            <div>🎉 עוזר AI הופעל!</div>
            <div style="font-size: 14px; margin-top: 8px; opacity: 0.9;">
                ${modelInfo.name} זמין עכשיו
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // הסרת ההתראה אחרי 4 שניות
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
        
        console.log(`🎉 AI Notification shown: ${modelInfo.name}`);
    }

    sendAIConfigToStudents(modelId, apiKey = null, hfToken = null) {
        console.log("%c=== TEACHER: Sending AI Config ===", "color: purple; font-weight: bold; font-size: 14px;");
        
        if (!this.gameConnection.isConnected) {
            console.error("�?Not connected to server");
            alert('�?לא מחובר לשרת');
            return false;
        }
        
        if (!this.availableModels[modelId]) {
            console.error("�?Invalid model ID:", modelId);
            alert('�?מודל לא תקין');
            return false;
        }
        
        const configMessage = {
            type: 'aiConfig',
            modelId: modelId,
            apiKey: apiKey,
            hfToken: hfToken,
            sender: this.gameConnection.playerName,
            timestamp: new Date().toISOString()
        };
        
        console.log("Sending config message:", configMessage);
        
        try {
            this.gameConnection.ws.send(JSON.stringify(configMessage));
            console.log("�?AI config message sent successfully");
            return true;
        } catch (error) {
            console.error("�?Error sending AI config:", error);
            alert('�?שגיאה בשליחת הגדרות AI');
            return false;
        }
    }

    enableChat() {
        this.createChatInterface();
        this.createAIInterface();
    }
    
    createChatInterface() {
        if (document.getElementById('chatButton')) return;
        this.chatButton = this.createDraggableButton('chatButton', '💬', '#007bff', this.toggleChat);
        this.chatContainer = this.createWindowContainer('chatContainer', `
            <div class="sdk-header" style="background: #2c3e50;">צ'אט עם המורה</div>
            <div id="chat-messages" class="sdk-messages"></div>
            <div class="sdk-input-area">
                <input id="chat-input" type="text" placeholder="הקלד הודעה...">
            </div>`);
        document.getElementById('chat-input').onkeypress = e => { if (e.key === 'Enter') { this.sendMessage(e.target.value); e.target.value = ''; } };
    }

    createAIInterface() {
        if (document.getElementById('aiButton')) return;
        this.aiButton = this.createDraggableButton('aiButton', '🤖', '#999', () => {
            if (this.aiConfig.isReady) this.toggleAI();
            else alert('🤖 AI לא הופעל על ידי המורה');
        });
        this.aiButton.style.right = '100px';

        this.aiContainer = this.createWindowContainer('aiContainer', `
            <div class="sdk-header" style="background: linear-gradient(45deg, #9c27b0, #673ab7);">
                🤖 עוזר AI<br><small id="ai-model-name" style="font-size: 0.8em; opacity: 0.9;">ממתין להפעלה...</small>
            </div>
            <div id="ai-messages" class="sdk-messages">
                 <div class="sdk-message ai-message"><div class="sdk-message-sender">🤖 עוזר AI</div><div class="sdk-message-content">שלום! אני ממתין שהמורה יפעיל אותי...</div></div>
            </div>
            <div class="sdk-input-area">
                <input id="ai-input" type="text" placeholder="ממתין להפעלת AI..." disabled>
                <button id="ai-send-btn" disabled>�?/button>
            </div>`);
        document.getElementById('ai-send-btn').onclick = () => this.sendAIMessage();
        document.getElementById('ai-input').onkeypress = e => { if (e.key === 'Enter') this.sendAIMessage(); };
        this.addBaseStyles();
    }
    
    async sendAIMessage() {
        const aiInput = document.getElementById('ai-input');
        const message = aiInput.value.trim();
        if (!message || !this.aiConfig.isReady) return;
        aiInput.value = '';
        this.addAIMessage(message, 'user');
        const loadingMsgId = `loading-${Date.now()}`;
        this.addAIMessage('חושב...', 'ai-thinking', loadingMsgId);

        try {
            const modelInfo = this.availableModels[this.aiConfig.model];
            const reply = modelInfo.type === 'gemini' 
                ? await this.sendToGemini(message) 
                : await this.sendToHuggingFace(message, modelInfo.endpoint);
            document.getElementById(loadingMsgId)?.remove();
            this.addAIMessage(reply, 'ai');
        } catch (error) {
            document.getElementById(loadingMsgId)?.remove();
            this.addAIMessage('מצטער, יש בעיה עם חיבור ל-AI. נסה שוב מאוחר יותר.', 'ai-error');
        }
    }

    async sendToGemini(message) {
        const response = await fetch(`${this.availableModels.gemini.endpoint}?key=${this.aiConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
        });
        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async sendToHuggingFace(message, endpoint) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.aiConfig.hfToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: message, parameters: { return_full_text: false } })
        });
        if (!response.ok) throw new Error(`Hugging Face API error: ${response.status}`);
        const data = await response.json();
        return data[0].generated_text.trim();
    }

    // --- UI Helper Functions ---
    createDraggableButton(id, html, bgColor, onClick) {
        const button = document.createElement('button');
        button.id = id;
        button.innerHTML = html;
        button.style.cssText = `position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: ${bgColor}; color: white; border: none; font-size: 24px; cursor: grab; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000; transition: background 0.3s;`;
        button.onclick = onClick;
        this.makeDraggable(button);
        document.body.appendChild(button);
        return button;
    }

    createWindowContainer(id, innerHTML) {
        const container = document.createElement('div');
        container.id = id;
        container.className = 'sdk-window';
        container.style.display = 'none';
        container.innerHTML = innerHTML;
        document.body.appendChild(container);
        return container;
    }

    updateAIInterface() {
        if (!this.aiConfig.isReady) return;
        const modelInfo = this.availableModels[this.aiConfig.model];
        document.getElementById('ai-model-name').innerHTML = `${modelInfo.icon} ${modelInfo.name}`;
        const aiInput = document.getElementById('ai-input');
        aiInput.disabled = false;
        aiInput.placeholder = 'שאל את ה-AI...';
        document.getElementById('ai-send-btn').disabled = false;
        const aiMessagesArea = document.getElementById('ai-messages');
        aiMessagesArea.innerHTML = '';
        this.addAIMessage(`שלום! אני ${modelInfo.name}. איך אוכל לעזור?`, 'ai');
    }

    updateAIButton() {
        if (!this.aiButton) return;
        if (this.aiConfig.isReady) {
            const modelInfo = this.availableModels[this.aiConfig.model];
            this.aiButton.innerHTML = modelInfo.icon;
            this.aiButton.title = `AI פעיל: ${modelInfo.name}`;
            this.aiButton.style.background = '#4CAF50';
        } else {
            this.aiButton.innerHTML = '🤖';
            this.aiButton.title = 'AI לא הופעל';
            this.aiButton.style.background = '#999';
        }
    }

    addAIMessage(content, type, elementId = null) {
        const area = document.getElementById('ai-messages');
        if (!area) return;
        const msgDiv = document.createElement('div');
        if (elementId) msgDiv.id = elementId;
        msgDiv.className = `sdk-message ${type}-message`;
        const sender = type === 'user' ? 'אני' : '🤖 עוזר AI';
        if (type === 'ai-thinking') content = '<i>חושב...</i>';
        msgDiv.innerHTML = `<div class="sdk-message-sender">${sender}</div><div class="sdk-message-content">${content}</div>`;
        area.appendChild(msgDiv);
        area.scrollTop = area.scrollHeight;
    }
    
    displayChatMessage(message) {
        const area = document.getElementById('chat-messages');
        if (!area) return;
        const msgDiv = document.createElement('div');
        const sender = message.sender === 'מורה' ? 'המורה' : (message.sender || 'אלמוני');
        msgDiv.className = 'sdk-message';
        msgDiv.innerHTML = `<div class="sdk-message-sender">${sender}</div><div class="sdk-message-content">${message.content}</div>`;
        area.appendChild(msgDiv);
        area.scrollTop = area.scrollHeight;
    }

    showNewMessageNotification(message) {
        // פונקציה להצגת התראה על הודעה חדשה (אופציונלי)
        console.log("New message notification:", message.content);
    }

    toggleChat() { if (this.chatContainer.style.display === 'none') this.openChat(); else this.closeChat(); }
    toggleAI() { if (this.aiContainer.style.display === 'none') this.openAI(); else this.closeAI(); }
    openChat() { this.chatContainer.style.display = 'flex'; this.closeAI(); }
    closeChat() { this.chatContainer.style.display = 'none'; }
    openAI() { this.aiContainer.style.display = 'flex'; this.closeChat(); }
    closeAI() { this.aiContainer.style.display = 'none'; }
    sendMessage(content) { if (content.trim() && this.gameConnection.isConnected) { this.gameConnection.ws.send(JSON.stringify({ type: 'message', content, sender: this.gameConnection.playerName })); this.displayChatMessage({ content, sender: 'אני' }); } }
    sendToTeacher(content) { this.sendMessage(content); }
    disconnect() { if(this.gameConnection.ws) this.gameConnection.ws.close(); }

    addBaseStyles() {
        if(document.getElementById('sdk-base-styles')) return;
        const style = document.createElement('style');
        style.id = 'sdk-base-styles';
        style.innerHTML = `
            .sdk-window { position: fixed; bottom: 90px; right: 20px; width: 350px; height: 450px; background: white; border-radius: 15px; box-shadow: 0 5px 25px rgba(0,0,0,0.2); display: none; flex-direction: column; z-index: 1001; overflow: hidden; font-family: Arial, sans-serif; }
            .sdk-header { color: white; padding: 15px; font-weight: bold; text-align: center; }
            .sdk-messages { flex: 1; padding: 10px; overflow-y: auto; background: #f8f9fa; }
            .sdk-input-area { padding: 10px; border-top: 1px solid #ddd; background: white; display:flex; gap: 10px; }
            .sdk-input-area input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px; direction: rtl; }
            .sdk-input-area button { width: 40px; height: 40px; border-radius: 50%; background: #9c27b0; color: white; border: none; cursor: pointer; font-size: 16px; }
            .sdk-input-area button:disabled { background: #999; cursor: not-allowed; }
            .sdk-message { margin: 10px 0; padding: 10px; border-radius: 10px; border-right-width: 4px; border-right-style: solid; }
            .sdk-message-sender { font-weight: bold; color: #333; margin-bottom: 5px; }
            .sdk-message-content { color: #555; white-space: pre-wrap; word-wrap: break-word; }
            .user-message { background: #e3f2fd; border-right-color: #2196F3; }
            .ai-message { background: #e8f5e8; border-right-color: #4CAF50; }
            .ai-error-message { background: #ffe6e6; border-right-color: #f44336; }
            .ai-thinking-message { background: #f0f0f0; border-right-color: #999; }
        `;
        document.head.appendChild(style);
    }
    
    makeDraggable(element) {
        let isDragging = false, initialX, initialY, xOffset = 0, yOffset = 0;
        const dragStart = (e) => {
            initialX = (e.touches ? e.touches[0].clientX : e.clientX) - xOffset;
            initialY = (e.touches ? e.touches[0].clientY : e.clientY) - yOffset;
            if (e.target === element || e.target.parentElement === element) isDragging = true;
        };
        const dragEnd = () => { isDragging = false; };
        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();
                const currentX = (e.touches ? e.touches[0].clientX : e.clientX) - initialX;
                const currentY = (e.touches ? e.touches[0].clientY : e.clientY) - initialY;
                xOffset = Math.max(0, Math.min(currentX, window.innerWidth - element.offsetWidth));
                yOffset = Math.max(0, Math.min(currentY, window.innerHeight - element.offsetHeight));
                element.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
            }
        };
        element.addEventListener('mousedown', dragStart);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('mousemove', drag);
        element.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchend', dragEnd);
        document.addEventListener('touchmove', drag, { passive: false });
        element.style.transform = `translate3d(${element.offsetLeft}px, ${element.offsetTop}px, 0)`;
    }
}