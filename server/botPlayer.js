/**
 * Bot Player - Okey Oyunu Bot AI
 * Sunucu tarafında çalışan yapay zeka oyuncu
 */

const BOT_NAMES = ['🤖 Ayşe Bot', '🤖 Mehmet Bot', '🤖 Fatma Bot', '🤖 Ali Bot'];
let botCounter = 0;

class BotPlayer {
    constructor(game, io, roomId) {
        this.game = game;
        this.io = io;
        this.roomId = roomId;
        this.turnTimeout = null;
    }

    // Bot ID oluştur
    static generateBotId() {
        return `bot_${Date.now()}_${++botCounter}`;
    }

    // Bot ismi al
    static getBotName() {
        return BOT_NAMES[botCounter % BOT_NAMES.length];
    }

    // Bot sırası geldiğinde oyna
    playTurn(playerId) {
        if (!this.game.gameStarted) return;
        
        const player = this.game.players.find(p => p.id === playerId);
        if (!player || !player.isBot) return;

        const currentPlayer = this.game.players[this.game.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== playerId) return;

        // 1-2 saniye bekle (doğal görünsün)
        const delay = 1000 + Math.random() * 1500;

        this.turnTimeout = setTimeout(() => {
            this._executeTurn(playerId);
        }, delay);
    }

    // Turu gerçekleştir
    _executeTurn(playerId) {
        if (!this.game.gameStarted) return;
        
        const currentPlayer = this.game.players[this.game.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== playerId) return;

        // 1. Taş çek
        const drawnTile = this._drawTile(playerId);
        if (!drawnTile) return;

        // Taş çekme bildirimini gönder
        this.io.to(this.roomId).emit('player-drew', {
            playerId: playerId,
            from: 'center',
            game: this.game.getGameState()
        });

        // Oyun taş bitmesi ile bittiyse dur
        if (!this.game.gameStarted) return;

        // 2. El geçerli mi kontrol et (bitirme denemesi)
        const hand = currentPlayer.hand;
        const handCheck = this.game.checkHand(hand);
        
        if (handCheck.valid) {
            // Eli aç ve bitir!
            const finishDelay = 500 + Math.random() * 500;
            setTimeout(() => {
                if (!this.game.gameStarted) return;
                const result = this.game.finishGame(playerId);
                if (result && result.success) {
                    this.io.to(this.roomId).emit('game-finished', {
                        winner: result.winner
                    });
                    console.log(`🤖 Bot ${currentPlayer.name} oyunu kazandı!`);
                }
            }, finishDelay);
            return;
        }

        // 3. Taş at (kısa bir gecikme ile)
        const discardDelay = 800 + Math.random() * 1000;
        setTimeout(() => {
            if (!this.game.gameStarted) return;
            this._discardTile(playerId);
        }, discardDelay);
    }

    // Taş çek (akıllı karar)
    _drawTile(playerId) {
        // Atılan taş varsa ve işimize yarayacaksa oradan çek
        if (this.game.discardPile.length > 0) {
            const lastDiscarded = this.game.discardPile[this.game.discardPile.length - 1];
            const player = this.game.players.find(p => p.id === playerId);
            
            if (player && this._isTileUseful(lastDiscarded, player.hand)) {
                const tile = this.game.drawFromDiscard(playerId);
                if (tile) {
                    console.log(`🤖 Bot atılan taşı çekti: ${tile.color} ${tile.number}`);
                    return tile;
                }
            }
        }

        // Ortadan çek
        if (this.game.isCenterEmpty()) {
            // Merkez boş, oyun bitmeli
            const result = this.game.endGameDraw();
            this.io.to(this.roomId).emit('game-ended-draw', {
                penalties: result.penalties,
                winner: this.game.winner
            });
            return null;
        }

        const tile = this.game.drawFromCenter(playerId);
        if (tile) {
            console.log(`🤖 Bot ortadan çekti: ${tile.color} ${tile.number}`);
        }
        return tile;
    }

    // Taş at (en az faydalı olanı)
    _discardTile(playerId) {
        const player = this.game.players.find(p => p.id === playerId);
        if (!player) return;

        const tileToDiscard = this._chooseTileToDiscard(player.hand);
        if (!tileToDiscard) return;

        const success = this.game.discardTile(playerId, tileToDiscard.id);
        if (success) {
            console.log(`🤖 Bot taş attı: ${tileToDiscard.color} ${tileToDiscard.number}`);

            // Tüm oyunculara bildir
            this.game.players.forEach(p => {
                this.io.to(p.id).emit('tile-discarded', {
                    playerId: playerId,
                    tile: tileToDiscard,
                    game: this.game.getGameState(p.id)
                });
            });

            // Sıradaki oyuncu da bot mu?
            this._checkNextTurn();
        }
    }

    // Sıradaki oyuncu bot mu kontrol et
    _checkNextTurn() {
        if (!this.game.gameStarted) return;
        
        const nextPlayer = this.game.players[this.game.currentPlayerIndex];
        if (nextPlayer && nextPlayer.isBot) {
            this.playTurn(nextPlayer.id);
        }
    }

    // Taş işe yarar mı? (per/seri yapılabilir mi)
    _isTileUseful(tile, hand) {
        if (tile.isFakeOkey) return true; // Sahte okey her zaman al
        if (this.game.isOkey(tile)) return true; // Okey her zaman al

        // Aynı sayıdan kaç farklı renk var?
        const sameNumber = hand.filter(t => 
            t.number === tile.number && t.color !== tile.color && !t.isFakeOkey
        );
        if (sameNumber.length >= 2) return true; // Per yapılabilir

        // Aynı renk ardışık var mı?
        const sameColor = hand.filter(t => 
            t.color === tile.color && !t.isFakeOkey
        );
        const hasNeighbor = sameColor.some(t => 
            Math.abs(t.number - tile.number) === 1
        );
        const hasNeighbor2 = sameColor.some(t =>
            Math.abs(t.number - tile.number) === 2
        );

        // 2 komşu = seri yapılabilir
        if (hasNeighbor) {
            const hasSecondNeighbor = sameColor.some(t =>
                t.number === tile.number - 1 || t.number === tile.number + 1
            );
            if (hasSecondNeighbor) return true;
        }

        return false;
    }

    // En az faydalı taşı seç
    _chooseTileToDiscard(hand) {
        // Okey ve sahte okeyi asla atma
        const discardable = hand.filter(t => 
            !t.isFakeOkey && !this.game.isOkey(t)
        );

        if (discardable.length === 0) {
            // Sadece okey/sahte okey kaldı, herhangi birini at
            return hand[0];
        }

        // Her taşa puan ver (düşük puan = daha az faydalı = at)
        const scored = discardable.map(tile => {
            let score = 0;

            // Aynı sayıdan farklı renkler (per potansiyeli)
            const sameNumber = hand.filter(t => 
                t.id !== tile.id && t.number === tile.number && 
                t.color !== tile.color && !t.isFakeOkey
            );
            score += sameNumber.length * 3;

            // Aynı renk ardışık (seri potansiyeli) 
            const sameColor = hand.filter(t =>
                t.id !== tile.id && t.color === tile.color && !t.isFakeOkey
            );
            
            const hasLeft = sameColor.some(t => t.number === tile.number - 1);
            const hasRight = sameColor.some(t => t.number === tile.number + 1);
            const hasLeft2 = sameColor.some(t => t.number === tile.number - 2);
            const hasRight2 = sameColor.some(t => t.number === tile.number + 2);

            if (hasLeft && hasRight) score += 6; // Ortadayım, seri var
            else if (hasLeft || hasRight) score += 3; // Seri potansiyeli
            if (hasLeft2 || hasRight2) score += 1; // Yakın taş var

            // Çiftler
            const hasPair = hand.some(t => 
                t.id !== tile.id && t.color === tile.color && 
                t.number === tile.number
            );
            if (hasPair) score += 2;

            return { tile, score };
        });

        // En düşük puanlı taşı at
        scored.sort((a, b) => a.score - b.score);
        return scored[0].tile;
    }

    // Temizle
    destroy() {
        if (this.turnTimeout) {
            clearTimeout(this.turnTimeout);
            this.turnTimeout = null;
        }
    }
}

module.exports = { BotPlayer };
