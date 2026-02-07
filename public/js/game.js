/**
 * Okey Game Client
 * Socket.io client ve oyun yönetimi
 */

class OkeyGameClient {
    constructor() {
        this.socket = null;
        this.playerName = '';
        this.roomId = '';
        this.gameState = null;
        this.selectedTile = null;
        this.isMyTurn = false;
        this.hasDrawn = false;

        this.init();
    }

    // Başlat
    init() {
        this.socket = io();
        this.setupSocketListeners();
        this.setupUIListeners();
    }

    // Socket event'lerini dinle
    setupSocketListeners() {
        // Bağlantı
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showToast('Sunucu bağlantısı kesildi', 'error');
        });

        // Oyuncu katıldı
        this.socket.on('player-joined', (data) => {
            this.gameState = data.game;
            this.updateWaitingRoom();
            this.showToast(`${data.playerName} odaya katıldı`, 'success');
        });

        // Oyuncu ayrıldı
        this.socket.on('player-left', (data) => {
            this.gameState = data.game;
            this.updateWaitingRoom();
            this.showToast(`${data.playerName} odadan ayrıldı`, 'warning');
        });

        // Oyun başladı
        this.socket.on('game-started', (data) => {
            this.gameState = data.game;
            this.showScreen('game-screen');
            this.updateGameUI();
            this.showToast('Oyun başladı!', 'success');
        });

        // Oyuncu taş çekti
        this.socket.on('player-drew', (data) => {
            this.gameState = data.game;
            this.updateGameUI();
        });

        // Taş atıldı
        this.socket.on('tile-discarded', (data) => {
            this.gameState = data.game;
            this.hasDrawn = false;
            this.updateGameUI();
        });

        // Oyun bitti
        this.socket.on('game-finished', (data) => {
            this.showResultModal(data.winner);
        });
    }

    // UI event listener'ları
    setupUIListeners() {
        // Lobi
        document.getElementById('create-room-btn').addEventListener('click', () => {
            this.createRoom();
        });

        document.getElementById('join-room-btn').addEventListener('click', () => {
            document.getElementById('join-form').classList.toggle('hidden');
        });

        document.getElementById('confirm-join-btn').addEventListener('click', () => {
            this.joinRoom();
        });

        // Enter tuşu ile isim girişi
        document.getElementById('player-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createRoom();
            }
        });

        document.getElementById('room-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });

        // Bekleme odası
        document.getElementById('copy-code-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(this.roomId);
            this.showToast('Kod kopyalandı!', 'success');
        });

        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('leave-room-btn').addEventListener('click', () => {
            location.reload();
        });

        // Oyun ekranı
        document.getElementById('center-pile').addEventListener('click', () => {
            this.drawFromCenter();
        });

        document.getElementById('discard-pile').addEventListener('click', () => {
            this.drawFromDiscard();
        });

        document.getElementById('finish-btn').addEventListener('click', () => {
            this.finishGame();
        });

        document.getElementById('sort-btn').addEventListener('click', () => {
            this.sortHand();
        });

        // Modal
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.hideResultModal();
            // Yeni oyun başlat (host ise)
            if (this.gameState && this.gameState.players[0]?.id === this.socket.id) {
                this.startGame();
            }
        });

        document.getElementById('back-to-lobby-btn').addEventListener('click', () => {
            location.reload();
        });
    }

    // Oda oluştur
    createRoom() {
        this.playerName = document.getElementById('player-name').value.trim();

        if (!this.playerName) {
            this.showToast('Lütfen adınızı girin', 'error');
            return;
        }

        this.socket.emit('create-room', this.playerName, (response) => {
            if (response.success) {
                this.roomId = response.roomId;
                this.gameState = response.game;
                this.showScreen('waiting-room');
                this.updateWaitingRoom();
                document.getElementById('display-room-code').textContent = this.roomId;
            } else {
                this.showToast(response.error, 'error');
            }
        });
    }

    // Odaya katıl
    joinRoom() {
        this.playerName = document.getElementById('player-name').value.trim();
        this.roomId = document.getElementById('room-code').value.trim().toUpperCase();

        if (!this.playerName) {
            this.showToast('Lütfen adınızı girin', 'error');
            return;
        }

        if (!this.roomId || this.roomId.length !== 6) {
            this.showToast('Geçerli bir oda kodu girin', 'error');
            return;
        }

        this.socket.emit('join-room', this.roomId, this.playerName, (response) => {
            if (response.success) {
                this.gameState = response.game;
                this.showScreen('waiting-room');
                this.updateWaitingRoom();
                document.getElementById('display-room-code').textContent = this.roomId;
            } else {
                this.showToast(response.error, 'error');
            }
        });
    }

    // Oyunu başlat
    startGame() {
        this.socket.emit('start-game', (response) => {
            if (!response.success) {
                this.showToast(response.error, 'error');
            }
        });
    }

    // Ortadan taş çek
    drawFromCenter() {
        if (!this.isMyTurn || this.hasDrawn) {
            this.showToast('Şu anda taş çekemezsiniz', 'warning');
            return;
        }

        this.socket.emit('draw-center', (response) => {
            if (response.success) {
                this.gameState.myHand.push(response.tile);
                this.hasDrawn = true;
                this.updateGameUI();
            } else {
                this.showToast(response.error, 'error');
            }
        });
    }

    // Atılan taşı çek
    drawFromDiscard() {
        if (!this.isMyTurn || this.hasDrawn) {
            this.showToast('Şu anda taş çekemezsiniz', 'warning');
            return;
        }

        this.socket.emit('draw-discard', (response) => {
            if (response.success) {
                this.gameState.myHand.push(response.tile);
                this.hasDrawn = true;
                this.updateGameUI();
            } else {
                this.showToast(response.error, 'error');
            }
        });
    }

    // Taş at
    discardTile(tileId) {
        if (!this.isMyTurn || !this.hasDrawn) {
            this.showToast('Önce taş çekmelisiniz', 'warning');
            return;
        }

        this.socket.emit('discard-tile', tileId, (response) => {
            if (response.success) {
                this.gameState = response.game;
                this.hasDrawn = false;
                this.updateGameUI();
            } else {
                this.showToast(response.error, 'error');
            }
        });
    }

    // Oyunu bitir
    finishGame() {
        if (!this.isMyTurn) {
            this.showToast('Sıranız değil', 'warning');
            return;
        }

        if (this.gameState.myHand.length !== 14) {
            this.showToast('Elinizde 14 taş olmalı', 'warning');
            return;
        }

        this.socket.emit('finish-game', (response) => {
            if (response.success) {
                this.showResultModal(response.winner);
            } else {
                this.showToast(response.error || 'Eliniz geçerli değil', 'error');
            }
        });
    }

    // Eli sırala
    sortHand() {
        if (this.gameState && this.gameState.myHand) {
            this.gameState.myHand = TileRenderer.sortTiles(this.gameState.myHand, 'color');
            this.renderPlayerHand();
        }
    }

    // Ekran değiştir
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    // Bekleme odasını güncelle
    updateWaitingRoom() {
        const grid = document.getElementById('players-grid');
        grid.innerHTML = '';

        for (let i = 0; i < 4; i++) {
            const slot = document.createElement('div');
            slot.className = 'player-slot';

            if (this.gameState.players[i]) {
                const player = this.gameState.players[i];
                const isHost = i === 0;
                const isMe = player.id === this.socket.id;

                slot.classList.add('filled');
                if (isHost) slot.classList.add('host');

                slot.innerHTML = `
                    <div class="avatar">${isMe ? '👤' : '🎮'}</div>
                    <div class="name">${player.name}${isMe ? ' (Sen)' : ''}</div>
                    <div class="status">Hazır</div>
                `;
            } else {
                slot.classList.add('empty');
                slot.innerHTML = `
                    <div class="avatar">❓</div>
                    <div class="name">Bekleniyor...</div>
                    <div class="status">-</div>
                `;
            }

            grid.appendChild(slot);
        }

        // Başlat butonu
        const startBtn = document.getElementById('start-game-btn');
        const playerCount = this.gameState.players.length;
        startBtn.querySelector('.player-count').textContent = `(${playerCount}/4)`;

        // Sadece host ve 4 oyuncu varsa etkinleştir
        const isHost = this.gameState.players[0]?.id === this.socket.id;
        startBtn.disabled = !isHost || playerCount !== 4;
    }

    // Oyun arayüzünü güncelle
    updateGameUI() {
        if (!this.gameState) return;

        // Sıra kontrolü
        this.isMyTurn = this.gameState.currentPlayerId === this.socket.id;

        // Gösterge ve okey bilgisi
        const indicatorContainer = document.getElementById('indicator-tile');
        TileRenderer.renderIndicator(indicatorContainer, this.gameState.indicator);

        const okeyInfo = document.getElementById('okey-info');
        if (this.gameState.okey) {
            const colorName = TileRenderer.colorNames[this.gameState.okey.color];
            okeyInfo.textContent = `${colorName} ${this.gameState.okey.number}`;
        }

        // Deste sayısı
        document.querySelector('.pile-count').textContent = this.gameState.centerTilesCount;

        // Atılan taş
        const lastDiscarded = this.gameState.discardPile && this.gameState.discardPile[0];
        TileRenderer.renderDiscardedTile(
            document.getElementById('last-discarded'),
            lastDiscarded,
            this.gameState.okey
        );

        // Sıra göstergesi
        const turnIndicator = document.getElementById('turn-indicator');
        const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
        document.getElementById('current-player-name').textContent =
            currentPlayer ? currentPlayer.name : '-';

        turnIndicator.classList.toggle('my-turn', this.isMyTurn);

        // Rakip taşları
        this.renderOpponents();

        // Oyuncunun eli
        this.renderPlayerHand();

        // Bitir butonu
        const finishBtn = document.getElementById('finish-btn');
        finishBtn.disabled = !this.isMyTurn || this.gameState.myHand?.length !== 14;
    }

    // Rakipleri render et
    renderOpponents() {
        const myIndex = this.gameState.players.findIndex(p => p.id === this.socket.id);
        const positions = ['opponent-right', 'opponent-top', 'opponent-left'];

        for (let i = 0; i < 3; i++) {
            const opponentIndex = (myIndex + i + 1) % 4;
            const opponent = this.gameState.players[opponentIndex];
            const positionEl = document.getElementById(positions[i]);

            if (opponent) {
                const nameEl = positionEl.querySelector('.player-name');
                const countEl = positionEl.querySelector('.tile-count');
                const tilesEl = positionEl.querySelector('.opponent-tiles');

                nameEl.textContent = opponent.name;
                countEl.textContent = `${opponent.tileCount} taş`;
                TileRenderer.renderOpponentTiles(tilesEl, opponent.tileCount);

                // Aktif oyuncu vurgula
                positionEl.classList.toggle('active',
                    this.gameState.currentPlayerIndex === opponentIndex);
            }
        }
    }

    // Oyuncunun elini render et
    renderPlayerHand() {
        const container = document.getElementById('player-hand');

        if (this.gameState.myHand) {
            TileRenderer.renderHand(
                container,
                this.gameState.myHand,
                this.gameState.okey,
                {
                    onSelect: (tile, tileEl) => {
                        if (this.isMyTurn && this.hasDrawn) {
                            // Taş at
                            this.discardTile(tile.id);
                        } else {
                            // Seçimi değiştir
                            TileRenderer.clearSelections(container);
                            TileRenderer.toggleTileSelection(tileEl);
                            this.selectedTile = tile;
                        }
                    },
                    onReorder: (draggedTile, targetTile, insertBefore) => {
                        // Taşları yeniden sırala
                        this.gameState.myHand = TileRenderer.reorderTiles(
                            this.gameState.myHand,
                            draggedTile,
                            targetTile,
                            insertBefore
                        );
                        this.renderPlayerHand();
                    }
                }
            );
        }
    }

    // Sonuç modalını göster
    showResultModal(winner) {
        document.getElementById('winner-name').textContent = winner.playerName;
        document.getElementById('winner-score').textContent = `${winner.score} Puan`;

        let details = [];
        if (winner.score > 100) {
            if (winner.type === 'seven_pairs') {
                details.push('7 Çift Bonusu: +50');
            }
            // Diğer bonuslar...
        }
        document.getElementById('score-details').textContent = details.join(' | ') || 'Klasik kazanç';

        document.getElementById('result-modal').classList.remove('hidden');
    }

    // Sonuç modalını gizle
    hideResultModal() {
        document.getElementById('result-modal').classList.add('hidden');
    }

    // Toast bildirimi göster
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Oyunu başlat
document.addEventListener('DOMContentLoaded', () => {
    window.game = new OkeyGameClient();
});
