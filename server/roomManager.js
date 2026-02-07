/**
 * Room Manager - Oda Yönetimi
 */

const { OkeyGame } = require('./gameLogic');

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    // Yeni oda oluştur
    createRoom(roomId, hostPlayer) {
        if (this.rooms.has(roomId)) {
            return { success: false, error: 'Room already exists' };
        }

        const game = new OkeyGame(roomId);
        game.addPlayer(hostPlayer);

        this.rooms.set(roomId, {
            id: roomId,
            host: hostPlayer.id,
            game,
            createdAt: Date.now()
        });

        return { success: true, room: this.rooms.get(roomId) };
    }

    // Odaya katıl
    joinRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }

        if (room.game.gameStarted) {
            return { success: false, error: 'Game already started' };
        }

        if (room.game.players.length >= 4) {
            return { success: false, error: 'Room is full' };
        }

        const added = room.game.addPlayer(player);
        if (!added) {
            return { success: false, error: 'Could not join room' };
        }

        return { success: true, room };
    }

    // Odadan ayrıl
    leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }

        room.game.removePlayer(playerId);

        // Eğer oda boşsa sil
        if (room.game.players.length === 0) {
            this.rooms.delete(roomId);
            return { success: true, roomDeleted: true };
        }

        // Eğer host ayrıldıysa, yeni host ata
        if (room.host === playerId && room.game.players.length > 0) {
            room.host = room.game.players[0].id;
        }

        return { success: true, roomDeleted: false };
    }

    // Odayı al
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    // Tüm odaları listele
    listRooms() {
        const roomList = [];
        for (const [id, room] of this.rooms) {
            roomList.push({
                id,
                playerCount: room.game.players.length,
                gameStarted: room.game.gameStarted,
                createdAt: room.createdAt
            });
        }
        return roomList;
    }

    // Rastgele oda ID'si oluştur
    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Oyuncunun bulunduğu odayı bul
    findPlayerRoom(playerId) {
        for (const [roomId, room] of this.rooms) {
            if (room.game.players.some(p => p.id === playerId)) {
                return roomId;
            }
        }
        return null;
    }
}

module.exports = { RoomManager };
