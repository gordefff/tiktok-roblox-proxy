const express = require('express');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================
// STATE
// ============================================

let TIKTOK_USERNAME = "febrydpx";
let chatMessages = [];
let giftQueue = [];
const MAX_MESSAGES = 100;
const MAX_GIFTS = 50;
let isConnected = false;
let tiktokConnection = null;
let viewerCount = 0;

// ============================================
// GIFT TIERS
// ============================================

const GIFT_TIERS = {
    "Rose": "small",
    "TikTok": "small",
    "Finger Heart": "small",
    "Ice Cream Cone": "small",
    "GG": "small",
    "Doughnut": "small",
    "Hat": "small",
    "Thumbs Up": "small",
    "Heart Me": "small",
    "Perfume": "medium",
    "Garland": "medium",
    "Singing Mic": "medium",
    "Star": "medium",
    "Hand Hearts": "medium",
    "Love You": "medium",
    "Corgi": "medium",
    "Cap": "medium",
    "Lock and Key": "medium",
    "Drama Queen": "large",
    "Money Gun": "large",
    "Gift Box": "large",
    "Whale Diving": "large",
    "Interstellar": "large",
    "Motorcycle": "large",
    "Sports Car": "large",
    "Concert": "large",
    "Lion": "epic",
    "Universe": "epic",
    "Planet": "epic",
    "TikTok Universe": "epic",
    "Rosa Nebula": "epic",
    "Adam's Dream": "epic",
    "Castle Fantasy": "epic",
    "Rocket": "epic",
};

function getGiftTier(giftName) {
    if (GIFT_TIERS[giftName]) return GIFT_TIERS[giftName];
    for (const [name, tier] of Object.entries(GIFT_TIERS)) {
        if (giftName.toLowerCase().includes(name.toLowerCase())) return tier;
    }
    return "small";
}

function trimMessages() {
    if (chatMessages.length > MAX_MESSAGES) chatMessages = chatMessages.slice(-MAX_MESSAGES);
    if (giftQueue.length > MAX_GIFTS) giftQueue = giftQueue.slice(-MAX_GIFTS);
}

// ============================================
// CONNECT TIKTOK
// ============================================

function connectTikTok(username) {
    if (!username) return;

    if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (e) {}
    }

    isConnected = false;
    chatMessages = [];
    giftQueue = [];

    console.log(`Connecting to @${username}...`);

    tiktokConnection = new WebcastPushConnection(username, {
        processInitialData: false,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 2000,
    });

    tiktokConnection.connect()
        .then(state => {
            isConnected = true;
            console.log(`Connected to @${username}!`);
            chatMessages.push({
                id: Date.now(),
                type: "system",
                user: "SYSTEM",
                nickname: "System",
                message: `Connected to @${username} live!`,
                timestamp: Date.now(),
                isSystem: true,
            });
        })
        .catch(err => {
            isConnected = false;
            console.log(`Failed to connect: ${err.message}`);
            chatMessages.push({
                id: Date.now(),
                type: "system",
                user: "SYSTEM",
                nickname: "System",
                message: `Failed: ${err.message}`,
                timestamp: Date.now(),
                isSystem: true,
                isError: true,
            });
        });

    tiktokConnection.on('chat', data => {
        chatMessages.push({
            id: Date.now() + Math.random(),
            type: "chat",
            user: data.uniqueId || "unknown",
            nickname: data.nickname || data.uniqueId || "unknown",
            message: data.comment || "",
            timestamp: Date.now(),
        });
        trimMessages();
    });

    tiktokConnection.on('gift', data => {
        const giftName = data.giftName || "Unknown Gift";
        const tier = getGiftTier(giftName);
        const count = data.repeatCount || 1;
        const userId = data.uniqueId || "unknown";
        const nickname = data.nickname || data.uniqueId || "unknown";
        const diamonds = data.diamondCount || 0;

        if (data.giftType === 1) {
            const existingIdx = giftQueue.findIndex(
                g => g.user === userId && g.giftName === giftName && !g.completed
            );

            if (existingIdx >= 0) {
                giftQueue[existingIdx].count = count;
                giftQueue[existingIdx].timestamp = Date.now();
            } else {
                giftQueue.push({
                    id: Date.now() + Math.random(),
                    user: userId,
                    nickname: nickname,
                    giftName: giftName,
                    count: count,
                    tier: tier,
                    diamonds: diamonds * count,
                    timestamp: Date.now(),
                    completed: false,
                });
            }

            if (data.repeatEnd) {
                const idx = giftQueue.findIndex(
                    g => g.user === userId && g.giftName === giftName && !g.completed
                );
                if (idx >= 0) {
                    giftQueue[idx].completed = true;
                    giftQueue[idx].count = count;
                    giftQueue[idx].diamonds = diamonds * count;
                }

                chatMessages.push({
                    id: Date.now() + Math.random(),
                    type: "gift",
                    user: userId,
                    nickname: nickname,
                    message: `${count}x ${giftName}`,
                    giftName: giftName,
                    giftCount: count,
                    tier: tier,
                    diamonds: diamonds * count,
                    timestamp: Date.now(),
                    isGift: true,
                });
                trimMessages();
            }
        } else {
            giftQueue.push({
                id: Date.now() + Math.random(),
                user: userId,
                nickname: nickname,
                giftName: giftName,
                count: count,
                tier: tier,
                diamonds: diamonds * count,
                timestamp: Date.now(),
                completed: true,
            });

            chatMessages.push({
                id: Date.now() + Math.random(),
                type: "gift",
                user: userId,
                nickname: nickname,
                message: `${count}x ${giftName}`,
                giftName: giftName,
                giftCount: count,
                tier: tier,
                diamonds: diamonds * count,
                timestamp: Date.now(),
                isGift: true,
            });
            trimMessages();
        }
    });

    tiktokConnection.on('like', data => {
        chatMessages.push({
            id: Date.now() + Math.random(),
            type: "like",
            user: data.uniqueId || "unknown",
            nickname: data.nickname || "unknown",
            message: `Liked!`,
            timestamp: Date.now(),
            isLike: true,
        });
        trimMessages();
    });

    tiktokConnection.on('social', data => {
        if (data.displayType && data.displayType.includes('follow')) {
            chatMessages.push({
                id: Date.now() + Math.random(),
                type: "follow",
                user: data.uniqueId || "unknown",
                nickname: data.nickname || "unknown",
                message: `Followed!`,
                timestamp: Date.now(),
                isFollow: true,
            });
            trimMessages();
        }
    });

    tiktokConnection.on('roomUser', data => {
        viewerCount = data.viewerCount || viewerCount;
    });

    tiktokConnection.on('disconnected', () => {
        isConnected = false;
        console.log(`Disconnected from @${username}`);
    });
}

// ============================================
// API ENDPOINTS
// ============================================

app.get('/', (req, res) => {
    res.json({
        status: "running",
        connected: isConnected,
        username: TIKTOK_USERNAME,
        viewers: viewerCount,
        messages: chatMessages.length,
    });
});

app.get('/chat', (req, res) => {
    const since = parseFloat(req.query.since) || 0;
    const newMessages = chatMessages.filter(m => m.id > since);
    res.json({
        connected: isConnected,
        username: TIKTOK_USERNAME,
        viewers: viewerCount,
        messages: newMessages,
        lastId: chatMessages.length > 0 ? chatMessages[chatMessages.length - 1].id : 0,
    });
});

app.get('/gifts', (req, res) => {
    const since = parseFloat(req.query.since) || 0;
    const completedGifts = giftQueue.filter(g => g.completed && g.id > since);
    res.json({
        gifts: completedGifts,
        lastId: giftQueue.length > 0 ? giftQueue[giftQueue.length - 1].id : 0,
    });
});

app.get('/connect/:username', (req, res) => {
    const username = req.params.username.replace('@', '').trim();
    if (!username) {
        return res.json({ error: "Username required" });
    }
    TIKTOK_USERNAME = username;
    connectTikTok(TIKTOK_USERNAME);
    res.json({ status: "connecting", username: TIKTOK_USERNAME });
});

app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        username: TIKTOK_USERNAME,
        viewers: viewerCount,
    });
});

app.get('/disconnect', (req, res) => {
    if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (e) {}
    }
    isConnected = false;
    res.json({ status: "disconnected" });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`TikTok-Roblox Proxy running on port ${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  GET /                    - Status`);
    console.log(`  GET /connect/:username   - Connect TikTok`);
    console.log(`  GET /chat?since=ID       - Get chat`);
    console.log(`  GET /gifts?since=ID      - Get gifts`);
    console.log(`  GET /status              - Status`);
    console.log(`  GET /disconnect          - Disconnect`);
});