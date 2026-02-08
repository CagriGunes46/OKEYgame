/**
 * Okey Game Server
 * Express + Socket.io
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { RoomManager } = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const roomManager = new RoomManager();

// Statik dosyaları sun
app.use(express.static(path.join(__dirname, '../public')));

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Oda listesi API
app.get('/api/rooms', (req, res) => {
    res.json(roomManager.listRooms());
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Oda oluştur
    socket.on('create-room', (playerName, callback) => {
        const roomId = roomManager.generateRoomId();
        const player = { id: socket.id, name: playerName };

        const result = roomManager.createRoom(roomId, player);

        if (result.success) {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;

            callback({ success: true, roomId, game: result.room.game.getGameState(socket.id) });
            console.log(`Room created: ${roomId} by ${playerName}`);
        } else {
            callback({ success: false, error: result.error });
        }
    });

    // Odaya katıl
    socket.on('join-room', (roomId, playerName, callback) => {
        const player = { id: socket.id, name: playerName };
        const result = roomManager.joinRoom(roomId, player);

        if (result.success) {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.playerName = playerName;

            const gameState = result.room.game.getGameState(socket.id);
            callback({ success: true, game: gameState });

            // Diğer oyunculara bildir
            socket.to(roomId).emit('player-joined', {
                playerId: socket.id,
                playerName,
                game: result.room.game.getGameState()
            });

            console.log(`${playerName} joined room: ${roomId}`);
        } else {
            callback({ success: false, error: result.error });
        }
    });

    // Oyunu başlat
    socket.on('start-game', (callback) => {
        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        if (room.host !== socket.id) {
            callback({ success: false, error: 'Only host can start the game' });
            return;
        }

        if (room.game.players.length !== 4) {
            callback({ success: false, error: 'Need 4 players to start' });
            return;
        }

        const started = room.game.startGame();
        if (started) {
            // Her oyuncuya kendi elini gönder
            room.game.players.forEach(player => {
                io.to(player.id).emit('game-started', {
                    game: room.game.getGameState(player.id)
                });
            });

            callback({ success: true });
            console.log(`Game started in room: ${socket.roomId}`);
        } else {
            callback({ success: false, error: 'Could not start game' });
        }
    });

    // Ortadan taş çek
    socket.on('draw-center', (callback) => {
        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        // Ortada taş yoksa oyunu bitir
        if (room.game.isCenterEmpty()) {
            const result = room.game.endGameDraw();

            // Tüm oyunculara bildir
            io.to(socket.roomId).emit('game-ended-draw', {
                reason: 'Ortadaki taşlar bitti',
                penalties: result.penalties,
                winner: room.game.winner
            });

            callback({ success: false, error: 'Ortada taş kalmadı, oyun bitti' });
            return;
        }

        const tile = room.game.drawFromCenter(socket.id);
        if (tile) {
            callback({ success: true, tile });

            // Diğer oyunculara bildir
            socket.to(socket.roomId).emit('player-drew', {
                playerId: socket.id,
                from: 'center',
                game: room.game.getGameState()
            });

            // Taş çektikten sonra ortada taş kaldı mı kontrol et
            if (room.game.isCenterEmpty()) {
                const result = room.game.endGameDraw();

                // Tüm oyunculara bildir
                io.to(socket.roomId).emit('game-ended-draw', {
                    reason: 'Ortadaki taşlar bitti',
                    penalties: result.penalties,
                    winner: room.game.winner
                });
            }
        } else {
            callback({ success: false, error: 'Cannot draw' });
        }
    });

    // Atılan taşı çek
    socket.on('draw-discard', (callback) => {
        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        const tile = room.game.drawFromDiscard(socket.id);
        if (tile) {
            callback({ success: true, tile });

            socket.to(socket.roomId).emit('player-drew', {
                playerId: socket.id,
                from: 'discard',
                game: room.game.getGameState()
            });
        } else {
            callback({ success: false, error: 'Cannot draw from discard' });
        }
    });

    // Taş at
    socket.on('discard-tile', (tileId, callback) => {
        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        const success = room.game.discardTile(socket.id, tileId);
        if (success) {
            callback({ success: true, game: room.game.getGameState(socket.id) });

            // Tüm oyunculara yayınla
            room.game.players.forEach(player => {
                io.to(player.id).emit('tile-discarded', {
                    playerId: socket.id,
                    game: room.game.getGameState(player.id)
                });
            });
        } else {
            callback({ success: false, error: 'Cannot discard' });
        }
    });

    // Oyunu bitir
    socket.on('finish-game', (callback) => {
        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        const result = room.game.finishGame(socket.id);
        if (result && result.success) {
            callback({ success: true, winner: result.winner });

            // Tüm oyunculara bildir
            io.to(socket.roomId).emit('game-finished', {
                winner: result.winner,
                game: room.game.getGameState()
            });

            console.log(`Game finished in room ${socket.roomId}. Winner: ${result.winner.playerName}`);
        } else {
            callback({ success: false, error: result?.reason || 'Cannot finish game' });
        }
    });

    // Bağlantı kesildi
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        if (socket.roomId) {
            const room = roomManager.getRoom(socket.roomId);
            console.log(`Room found: ${!!room}, Game started: ${room?.game?.gameStarted}`);

            // Oyun devam ediyorsa, oyunu bitir
            if (room && room.game.gameStarted) {
                console.log('Ending game because player left...');
                const result = room.game.endGameByPlayerLeft(socket.id, socket.playerName);

                // Tüm oyunculara bildir ve lobiye gönder
                io.to(socket.roomId).emit('game-ended-player-left', {
                    reason: `${socket.playerName} oyundan ayrıldı`,
                    leftPlayer: socket.playerName,
                    winner: room.game.winner
                });

                console.log(`Game ended in room ${socket.roomId} because ${socket.playerName} left`);
            } else {
                console.log('Game was not started or room not found, skipping game end');
            }

            // Odadan çık
            const result = roomManager.leaveRoom(socket.roomId, socket.id);

            if (!result.roomDeleted) {
                const updatedRoom = roomManager.getRoom(socket.roomId);
                if (updatedRoom) {
                    io.to(socket.roomId).emit('player-left', {
                        playerId: socket.id,
                        playerName: socket.playerName,
                        game: updatedRoom.game.getGameState()
                    });
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`🎮 Okey Game Server running on http://localhost:${PORT}`);
});
