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
        this.localHandOrder = null; // Kullanıcının taş sıralamasını korur

        this.init();
    }

    // Sunucudan gelen eli, kullanıcının sıralamasıyla birleştir
    mergeHandWithOrder(serverHand) {
        if (!serverHand) return null;

        // İlk kez veya lokal sıralama yoksa sunucunun sıralamasını kullan
        if (!this.localHandOrder || this.localHandOrder.length === 0) {
            this.localHandOrder = serverHand.map(t => t.id);
            return serverHand;
        }

        // Sunucudaki taş ID'leri
        const serverIds = new Set(serverHand.map(t => t.id));

        // Lokal sıralamadan kaldırılmış taşları çıkar
        this.localHandOrder = this.localHandOrder.filter(id => serverIds.has(id));

        // Yeni taşları bul (sunucuda var ama lokalde yok)
        const localIds = new Set(this.localHandOrder);
        const newTiles = serverHand.filter(t => !localIds.has(t.id));

        // Yeni taşları sona ekle
        newTiles.forEach(t => this.localHandOrder.push(t.id));

        // Eli lokal sıralamaya göre yeniden oluştur
        const tileMap = new Map(serverHand.map(t => [t.id, t]));
        return this.localHandOrder.map(id => tileMap.get(id)).filter(t => t);
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
            if (this.gameState && data.game) {
                this.gameState = data.game;
            }
            this.updateWaitingRoom();
            this.showToast(`${data.playerName} odadan ayrıldı`, 'warning');
        });

        // Oyun başladı
        this.socket.on('game-started', (data) => {
            this.localHandOrder = null; // Yeni oyun, sıralamayı sıfırla
            this.gameState = data.game;
            this.gameState.myHand = this.mergeHandWithOrder(data.game.myHand);
            this.showScreen('game-screen');
            // Oda kodunu göster
            document.getElementById('game-room-code').textContent = this.roomId;
            this.updateGameUI();
            this.showToast('Oyun başladı!', 'success');
        });

        // Oyuncu taş çekti
        this.socket.on('player-drew', (data) => {
            // Kendi çektiğimiz taşı zaten callback'te ekledik, tekrar eklemeyelim
            if (data.playerId === this.socket.id) {
                // Sadece diğer bilgileri güncelle (centerTilesCount vb.)
                const myHand = this.gameState.myHand;
                this.gameState = data.game;
                this.gameState.myHand = myHand;
            } else {
                // Başka oyuncu çekti, elimizi koruyarak güncelle
                const preservedHand = this.mergeHandWithOrder(data.game.myHand);
                this.gameState = data.game;
                this.gameState.myHand = preservedHand;
            }
            this.updateGameUI();
        });

        // Taş atıldı
        this.socket.on('tile-discarded', (data) => {
            // Elimizi koruyarak güncelle
            const preservedHand = this.mergeHandWithOrder(data.game.myHand);
            this.gameState = data.game;
            this.gameState.myHand = preservedHand;
            this.hasDrawn = false;
            this.updateGameUI();
        });

        // Oyun bitti
        this.socket.on('game-finished', (data) => {
            this.showResultModal(data.winner);
        });


        // Taşlar bitti - berabere
        this.socket.on('game-ended-draw', (data) => {
            console.log('Game ended - draw:', data);
            this.showDrawResultModal(data.winner, data.penalties);
        });

        // Oyuncu çıktı - oyun bitti
        this.socket.on('game-ended-player-left', (data) => {
            console.log('Game ended - player left:', data);
            this.showPlayerLeftModal(data.leftPlayer, data.winner);
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

        document.getElementById('add-bot-btn').addEventListener('click', () => {
            this.addBot();
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

        // Eli Aç butonu
        document.getElementById('open-hand-btn').addEventListener('click', () => {
            this.openHandForGrouping();
        });

        document.getElementById('sort-btn').addEventListener('click', () => {
            this.sortHand();
        });

        document.getElementById('sort-color-btn').addEventListener('click', () => {
            this.sortHandByColor();
        });

        document.getElementById('sort-number-btn').addEventListener('click', () => {
            this.sortHandByNumber();
        });

        // Grup alanı
        document.getElementById('cancel-group-btn').addEventListener('click', () => {
            this.cancelGrouping();
        });

        document.getElementById('confirm-finish-btn').addEventListener('click', () => {
            this.finishGame();
        });

        // Grup alanlarına drop zone ekle
        this.setupGroupDropZones();

        // Çıkış butonu
        document.getElementById('exit-game-btn').addEventListener('click', () => {
            if (confirm('Oyundan çıkmak istediğinize emin misiniz?')) {
                location.reload();
            }
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

    // Bot ekle
    addBot() {
        this.socket.emit('add-bot', (response) => {
            if (response.success) {
                this.showToast(`${response.botPlayer.name} eklendi!`, 'success');
            } else {
                this.showToast(response.error || 'Bot eklenemedi', 'error');
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
                // Lokal sıralamaya da ekle
                if (this.localHandOrder) {
                    this.localHandOrder.push(response.tile.id);
                }
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
                // Lokal sıralamaya da ekle
                if (this.localHandOrder) {
                    this.localHandOrder.push(response.tile.id);
                }
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
                // Elimizi koruyarak güncelle (sıralama kaybolmasın)
                const preservedHand = this.mergeHandWithOrder(response.game.myHand);
                this.gameState = response.game;
                this.gameState.myHand = preservedHand;
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

        // Grupları al (kullanıcı elle gruplamışsa)
        const groups = this.getGroupedHand();

        this.socket.emit('finish-game', { groups: groups }, (response) => {
            if (response.success) {
                this.showResultModal(response.winner);
            } else {
                this.showToast(response.error || response.reason || 'Eliniz geçerli değil', 'error');
            }
        });
    }

    // Eli sırala (Okey kurallarına göre - Akıllı)
    sortHand() {
        if (this.gameState && this.gameState.myHand) {
            this.gameState.myHand = TileRenderer.smartSortTiles(
                this.gameState.myHand,
                this.gameState.okey
            );
            this.localHandOrder = this.gameState.myHand.map(t => t.id);
            this.renderPlayerHand();
            this.showToast('Akıllı sıralama yapıldı', 'success');
        }
    }

    // Renge göre sırala
    sortHandByColor() {
        if (this.gameState && this.gameState.myHand) {
            this.gameState.myHand = TileRenderer.sortTiles(this.gameState.myHand, 'color');
            this.localHandOrder = this.gameState.myHand.map(t => t.id);
            this.renderPlayerHand();
            this.showToast('Renge göre sıralandı', 'success');
        }
    }

    // Sayıya göre sırala
    sortHandByNumber() {
        if (this.gameState && this.gameState.myHand) {
            this.gameState.myHand = TileRenderer.sortTiles(this.gameState.myHand, 'number');
            this.localHandOrder = this.gameState.myHand.map(t => t.id);
            this.renderPlayerHand();
            this.showToast('Sayıya göre sıralandı', 'success');
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
                const isBot = player.isBot || player.id?.startsWith('bot_');

                slot.classList.add('filled');
                if (isHost) slot.classList.add('host');
                if (isBot) slot.classList.add('bot');

                const avatar = isBot ? '🤖' : (isMe ? '👤' : '🎮');
                const label = isBot ? ' (Bot)' : (isMe ? ' (Sen)' : '');

                slot.innerHTML = `
                    <div class="avatar">${avatar}</div>
                    <div class="name">${player.name}${label}</div>
                    <div class="status">${isBot ? 'Bot' : 'Hazır'}</div>
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

        // Bot ekle butonu: sadece host görsün, oda doluysa gizle
        const addBotBtn = document.getElementById('add-bot-btn');
        if (addBotBtn) {
            addBotBtn.style.display = (isHost && playerCount < 4) ? '' : 'none';
        }
    }

    // Oyun arayüzünü güncelle
    updateGameUI() {
        if (!this.gameState) return;

        // Sıra kontrolü
        this.isMyTurn = this.gameState.currentPlayerId === this.socket.id;

        // 15 taşlı ilk oyuncu kontrolü (taş çekmiş sayılır)
        // 1. oyuncu 15 taşla başlar ve direkt taş atmalıdır
        if (this.isMyTurn && this.gameState.myHand?.length === 15) {
            this.hasDrawn = true; // 15 taşı olan oyuncu taş çekmiş gibi işlem görür
        }

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

        // Eli Aç butonu - sıra oyuncudaysa her zaman aktif
        const openHandBtn = document.getElementById('open-hand-btn');
        openHandBtn.disabled = !this.isMyTurn;
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
                    onReorder: (draggedId, targetId, insertBefore) => {
                        // Taşları yeniden sırala (ID'lerle çalışır)
                        this.gameState.myHand = TileRenderer.reorderTilesById(
                            this.gameState.myHand,
                            draggedId,
                            targetId,
                            insertBefore
                        );
                        // Lokal sıralamayı güncelle (sunucu güncellemelerinde korunması için)
                        this.localHandOrder = this.gameState.myHand.map(t => t.id);
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

        // Kazananın elini göster
        const winnerHandContainer = document.getElementById('winner-hand-display');
        winnerHandContainer.innerHTML = '';

        if (winner.hand && winner.hand.length > 0) {
            winner.hand.forEach(tile => {
                const isOkey = !tile.isFakeOkey &&
                    this.gameState.okey &&
                    tile.color === this.gameState.okey.color &&
                    tile.number === this.gameState.okey.number;

                const tileEl = TileRenderer.createTileElement(tile, 0, { isOkey });
                tileEl.draggable = false;
                winnerHandContainer.appendChild(tileEl);
            });
        }

        // Diğer oyuncuların ellerini göster
        const otherHandsContainer = document.getElementById('other-hands-display');
        otherHandsContainer.innerHTML = '';

        if (winner.allHands && winner.allHands.length > 0) {
            winner.allHands
                .filter(p => !p.isWinner) // Kazananı atla
                .forEach(playerData => {
                    const row = document.createElement('div');
                    row.className = 'player-hand-row';

                    const label = document.createElement('span');
                    label.className = 'player-label';
                    label.textContent = playerData.playerName;
                    row.appendChild(label);

                    const tilesRow = document.createElement('div');
                    tilesRow.className = 'tiles-row';

                    if (playerData.hand && playerData.hand.length > 0) {
                        playerData.hand.forEach(tile => {
                            const isOkey = !tile.isFakeOkey &&
                                this.gameState.okey &&
                                tile.color === this.gameState.okey.color &&
                                tile.number === this.gameState.okey.number;

                            const tileEl = TileRenderer.createTileElement(tile, 0, { isOkey });
                            tileEl.draggable = false;
                            tilesRow.appendChild(tileEl);
                        });
                    }

                    row.appendChild(tilesRow);
                    otherHandsContainer.appendChild(row);
                });
        }

        document.getElementById('result-modal').classList.remove('hidden');
    }

    // Sonuç modalını gizle
    hideResultModal() {
        document.getElementById('result-modal').classList.add('hidden');
    }

    // Taşlar bittiğinde modal göster (berabere)
    showDrawResultModal(winner, penalties) {
        document.getElementById('result-title').textContent = '⚖️ Taşlar Bitti!';
        document.getElementById('winner-name').textContent = 'Berabere';
        document.getElementById('winner-score').textContent = 'Ceza Puanları';
        document.getElementById('score-details').textContent = 'Ortadaki taşlar tükendi';

        // Kazananın elini temizle (kazanan yok)
        const winnerHandContainer = document.getElementById('winner-hand-display');
        winnerHandContainer.innerHTML = '<p style="color: var(--text-muted);">Kazanan yok</p>';

        // Tüm oyuncuların ceza puanlarını göster
        const otherHandsContainer = document.getElementById('other-hands-display');
        otherHandsContainer.innerHTML = '';

        if (penalties && penalties.length > 0) {
            // Ceza puanına göre sırala (en düşük en üstte)
            const sortedPenalties = [...penalties].sort((a, b) => a.penalty - b.penalty);

            sortedPenalties.forEach((playerData, index) => {
                const row = document.createElement('div');
                row.className = 'player-hand-row';
                if (index === 0) row.style.border = '2px solid var(--accent-primary)';

                const label = document.createElement('span');
                label.className = 'player-label';
                label.innerHTML = `${index === 0 ? '🥇 ' : ''}${playerData.playerName} <span style="color: var(--error); margin-left: 10px;">-${playerData.penalty} puan</span>`;
                row.appendChild(label);

                const tilesRow = document.createElement('div');
                tilesRow.className = 'tiles-row';

                if (playerData.hand && playerData.hand.length > 0) {
                    playerData.hand.forEach(tile => {
                        const isOkey = !tile.isFakeOkey &&
                            this.gameState.okey &&
                            tile.color === this.gameState.okey.color &&
                            tile.number === this.gameState.okey.number;

                        const tileEl = TileRenderer.createTileElement(tile, 0, { isOkey });
                        tileEl.draggable = false;
                        tilesRow.appendChild(tileEl);
                    });
                }

                row.appendChild(tilesRow);
                otherHandsContainer.appendChild(row);
            });
        }

        document.getElementById('result-modal').classList.remove('hidden');
    }

    // Oyuncu çıktığında modal göster
    showPlayerLeftModal(leftPlayer, winner) {
        document.getElementById('result-title').textContent = '🚪 Oyun Sonlandırıldı';
        document.getElementById('winner-name').textContent = `${leftPlayer} oyunu terk etti`;
        document.getElementById('winner-score').textContent = '';
        document.getElementById('score-details').textContent = 'Oyun iptal edildi';

        // El gösterimlerini temizle
        document.getElementById('winner-hand-display').innerHTML =
            '<p style="color: var(--text-muted);">Oyun tamamlanmadan bitti</p>';
        document.getElementById('other-hands-display').innerHTML = '';

        document.getElementById('result-modal').classList.remove('hidden');

        // 5 saniye sonra lobiye dön
        this.showToast('5 saniye içinde lobiye yönlendiriliyorsunuz...', 'warning');
        setTimeout(() => {
            this.hideResultModal();
            this.showScreen('lobby-screen');
            this.gameState = null;
            this.localHandOrder = null;
        }, 5000);
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

    // ============================================
    // ELİ AÇMA VE GRUPLAMA
    // ============================================

    // Eli açmak için gruplandırma ekranını göster
    openHandForGrouping() {
        if (!this.isMyTurn) {
            this.showToast('Sıranız değil', 'warning');
            return;
        }

        // Grupları temizle
        this.tileGroups = [[], [], [], [], []];

        // Tüm taşları ilk gruba koy
        this.tileGroups[0] = [...this.gameState.myHand];

        // Normal eli gizle, grup alanını göster
        document.getElementById('player-hand').classList.add('hidden');
        document.querySelector('.hand-actions').classList.add('hidden');
        document.getElementById('group-area').classList.remove('hidden');

        this.renderGroups();
    }

    // Gruplandırmayı iptal et
    cancelGrouping() {
        document.getElementById('group-area').classList.add('hidden');
        document.getElementById('player-hand').classList.remove('hidden');
        document.querySelector('.hand-actions').classList.remove('hidden');
        this.tileGroups = null;
    }

    // Grup drop zone'larını ayarla
    setupGroupDropZones() {
        const groupContainers = document.querySelectorAll('.group-tiles');

        groupContainers.forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.parentElement.classList.add('drag-over');
            });

            container.addEventListener('dragleave', (e) => {
                container.parentElement.classList.remove('drag-over');
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.parentElement.classList.remove('drag-over');

                const tileId = parseInt(e.dataTransfer.getData('text/plain'));
                const targetGroup = parseInt(container.dataset.group) - 1;

                this.moveTileToGroup(tileId, targetGroup);
            });
        });
    }

    // Taşı gruba taşı
    moveTileToGroup(tileId, targetGroupIndex) {
        if (!this.tileGroups) return;

        let tile = null;
        let sourceGroupIndex = -1;

        // Taşı bul ve eski gruptan çıkar
        for (let i = 0; i < this.tileGroups.length; i++) {
            const idx = this.tileGroups[i].findIndex(t => t.id === tileId);
            if (idx !== -1) {
                tile = this.tileGroups[i].splice(idx, 1)[0];
                sourceGroupIndex = i;
                break;
            }
        }

        if (tile && sourceGroupIndex !== targetGroupIndex) {
            this.tileGroups[targetGroupIndex].push(tile);
            this.renderGroups();
        } else if (tile) {
            // Aynı gruba bırakılmış, geri ekle
            this.tileGroups[sourceGroupIndex].push(tile);
        }
    }

    // Grupları render et
    renderGroups() {
        if (!this.tileGroups) return;

        for (let i = 0; i < 5; i++) {
            const container = document.querySelector(`.group-tiles[data-group="${i + 1}"]`);
            container.innerHTML = '';

            this.tileGroups[i].forEach(tile => {
                const isOkey = !tile.isFakeOkey &&
                    this.gameState.okey &&
                    tile.color === this.gameState.okey.color &&
                    tile.number === this.gameState.okey.number;

                const tileEl = TileRenderer.createTileElement(tile, 0, { isOkey });
                tileEl.draggable = true;

                tileEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', tile.id);
                    tileEl.classList.add('dragging');
                });

                tileEl.addEventListener('dragend', () => {
                    tileEl.classList.remove('dragging');
                });

                container.appendChild(tileEl);
            });

            // Grup etiketini güncelle
            const label = container.parentElement.querySelector('.group-label');
            const count = this.tileGroups[i].length;
            label.textContent = `Grup ${i + 1} (${count} taş)`;
        }
    }

    // Grupları sunucuya gönder
    getGroupedHand() {
        if (!this.tileGroups) return null;

        // Boş olmayan grupları al
        const groups = this.tileGroups
            .filter(g => g.length > 0)
            .map(g => g.map(t => t.id));

        return groups;
    }
}

// Oyunu başlat
document.addEventListener('DOMContentLoaded', () => {
    window.game = new OkeyGameClient();
});
