// server.js
const WebSocket = require("ws");
const EventSource = require("eventsource");

const USER_TOKEN = process.env.USER_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
const clients = new Set();

wss.on("connection", (ws) => {
    console.log("Roblox client connected");
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
});

function broadcast(jobId) {
    const payload = JSON.stringify({ jobId });
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

// Connect to Discord gateway as user
function connectGateway() {
    const gateway = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
    let heartbeatInterval = null;
    let sequence = null;

    gateway.on("message", (data) => {
        const msg = JSON.parse(data);

        // Opcodes
        if (msg.op === 10) {
            // Hello - start heartbeat
            heartbeatInterval = setInterval(() => {
                gateway.send(JSON.stringify({ op: 1, d: sequence }));
            }, msg.d.heartbeat_interval);

            // Identify
            gateway.send(JSON.stringify({
                op: 2,
                d: {
                    token: USER_TOKEN,
                    properties: {
                        os: "windows",
                        browser: "chrome",
                        device: ""
                    },
                    presence: {
                        status: "online",
                        afk: false
                    }
                }
            }));
        }

        if (msg.s) sequence = msg.s;

        // Message received
        if (msg.t === "MESSAGE_CREATE") {
            const message = msg.d;
            if (message.channel_id !== CHANNEL_ID) return;

            const matches = message.content.match(/wnotifier-[A-Za-z0-9_\-+=]+/g);
            if (!matches) return;

            for (const id of matches) {
                console.log("Found ID:", id);
                broadcast(id);
            }
        }
    });

    gateway.on("close", () => {
        console.log("Gateway closed, reconnecting in 5s...");
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        setTimeout(connectGateway, 5000);
    });

    gateway.on("error", (err) => {
        console.error("Gateway error:", err);
    });
}

connectGateway();
console.log("Proxy running...");
