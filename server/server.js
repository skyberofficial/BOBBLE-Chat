const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    socket.on('register', (userId) => {
        userSockets.set(userId, socket.id);
        console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    socket.on('send_message', (data) => {
        const { senderId, receiverId, content, timestamp } = data;
        console.log(`Server: message from ${senderId} to ${receiverId}, ID: ${data.id || 'new'}`);
        const receiverSocketId = userSockets.get(receiverId);

        if (receiverSocketId) {
            const messageId = data.id || `socket-${Date.now()}`;
            // Emit the message to the receiver
            io.to(receiverSocketId).emit('receive_message', {
                senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                content,
                timestamp,
                conversationId: data.conversationId,
                type: data.type || 'text',
                id: messageId
            });
            // Notify the sender that the message was delivered
            const senderSocketId = userSockets.get(senderId);
            if (senderSocketId) {
                console.log(`Server: notifying sender ${senderId} of delivery for ID ${messageId}`);
                io.to(senderSocketId).emit('message_delivered', {
                    id: messageId,
                    conversationId: data.conversationId
                });
            }
        }
    });

    socket.on('mark_as_read', (data) => {
        const { conversationId, messageIds, readerId, senderId } = data;
        console.log(`Server: mark_as_read from ${readerId} for ${messageIds.length} messages in ${conversationId}`);
        const senderSocketId = userSockets.get(senderId);
        if (senderSocketId) {
            console.log(`Server: notifying sender ${senderId} that reader ${readerId} has seen the messages`);
            io.to(senderSocketId).emit('message_read', {
                conversationId,
                messageIds,
                readerId
            });
        }
    });

    socket.on('delete_message', (data) => {
        const { messageId, receiverId } = data;
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('message_deleted', { messageId });
        }
    });

    socket.on('delete_conversation', (data) => {
        const { senderId, receiverId } = data;
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('conversation_deleted', { senderId });
        }
    });

    socket.on('typing', (data) => {
        const { senderId, receiverId } = data;
        console.log(`Server received typing from ${senderId} to ${receiverId}`);
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user_typing', { senderId });
        } else {
            console.log(`Receiver ${receiverId} not found/connected for typing event`);
        }
    });

    socket.on('stop_typing', (data) => {
        const { senderId, receiverId } = data;
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user_stop_typing', { senderId });
        }
    });

    // WebRTC Signaling
    socket.on('call-user', (data) => {
        const { from, to, offer, type } = data;
        const receiverSocketId = userSockets.get(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('incoming-call', { from, offer, type });
        }
    });

    socket.on('answer-call', (data) => {
        const { from, to, answer } = data;
        const receiverSocketId = userSockets.get(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-answered', { from, answer });
        }
    });

    socket.on('ice-candidate', (data) => {
        const { from, to, candidate } = data;
        const receiverSocketId = userSockets.get(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('ice-candidate', { from, candidate });
        }
    });

    socket.on('hangup', (data) => {
        const { from, to } = data;
        const receiverSocketId = userSockets.get(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-ended', { from });
        }
    });

    socket.on('reject-call', (data) => {
        const { from, to } = data;
        const receiverSocketId = userSockets.get(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-rejected', { from });
        }
    });

    socket.on('new_user_joined', (user) => {
        // Broadcast to everyone except sender (which is the server action usually)
        socket.broadcast.emit('notification', {
            type: 'user_joined',
            data: user, // { id, name, username, avatar }
            timestamp: Date.now()
        });
        console.log(`New user joined notification broadcast: ${user.username}`);
    });

    socket.on('disconnect', () => {
        for (const [userId, socketId] of userSockets.entries()) {
            if (socketId === socket.id) {
                userSockets.delete(userId);
                console.log(`User ${userId} disconnected`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
});
