/**
 * Okey Game Logic
 * 106 taş: 4 renk × 13 sayı × 2 set + 2 sahte okey
 */

const COLORS = ['yellow', 'blue', 'black', 'red'];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

class OkeyGame {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = [];
        this.tiles = [];
        this.discardPile = [];
        this.indicator = null; // Gösterge taşı
        this.okey = null; // Okey (joker)
        this.currentPlayerIndex = 0;
        this.gameStarted = false;
        this.centerTiles = []; // Ortadaki taşlar
        this.winner = null;
    }

    // Oyuncuyu ekle
    addPlayer(player) {
        if (this.players.length >= 4) return false;
        this.players.push({
            id: player.id,
            name: player.name,
            hand: [],
            isReady: false
        });
        return true;
    }

    // Oyuncuyu çıkar
    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.players.splice(index, 1);
            return true;
        }
        return false;
    }

    // Tüm taşları oluştur
    createTiles() {
        this.tiles = [];
        let id = 0;

        // 4 renk × 13 sayı × 2 set = 104 taş
        for (let set = 0; set < 2; set++) {
            for (const color of COLORS) {
                for (const number of NUMBERS) {
                    this.tiles.push({
                        id: id++,
                        color,
                        number,
                        isFakeOkey: false
                    });
                }
            }
        }

        // 2 sahte okey (joker)
        this.tiles.push({ id: id++, color: 'fake', number: 0, isFakeOkey: true });
        this.tiles.push({ id: id++, color: 'fake', number: 0, isFakeOkey: true });

        return this.tiles;
    }

    // Taşları karıştır
    shuffleTiles() {
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
    }

    // Gösterge ve okeyi belirle
    determineOkey() {
        // Rastgele bir taş seç (sahte okey olmayan)
        const validTiles = this.tiles.filter(t => !t.isFakeOkey);
        const indicatorIndex = Math.floor(Math.random() * validTiles.length);
        this.indicator = validTiles[indicatorIndex];

        // Okey: göstergenin bir üstü (13'ten sonra 1 gelir)
        const okeyNumber = this.indicator.number === 13 ? 1 : this.indicator.number + 1;
        this.okey = {
            color: this.indicator.color,
            number: okeyNumber
        };

        // Göstergeyi taşlardan çıkar (masa üstüne koyulur)
        const tileIndex = this.tiles.findIndex(t => t.id === this.indicator.id);
        if (tileIndex !== -1) {
            this.tiles.splice(tileIndex, 1);
        }

        return { indicator: this.indicator, okey: this.okey };
    }

    // Taşları dağıt
    dealTiles() {
        // İlk oyuncu 15, diğerleri 14 taş alır
        for (let i = 0; i < this.players.length; i++) {
            const count = i === 0 ? 15 : 14;
            this.players[i].hand = this.tiles.splice(0, count);
        }

        // Kalan taşlar ortadaki deste
        this.centerTiles = [...this.tiles];
        this.tiles = [];
    }

    // Oyunu başlat
    startGame() {
        if (this.players.length !== 4) return false;

        this.createTiles();
        this.shuffleTiles();
        this.determineOkey();
        this.dealTiles();
        this.gameStarted = true;
        this.currentPlayerIndex = 0;
        this.winner = null;

        return true;
    }

    // Ortadan taş çek
    drawFromCenter(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.currentPlayerIndex) return null;
        if (this.centerTiles.length === 0) return null;

        const tile = this.centerTiles.shift();
        this.players[playerIndex].hand.push(tile);
        return tile;
    }

    // Atılan taşı çek (sol oyuncudan)
    drawFromDiscard(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.currentPlayerIndex) return null;
        if (this.discardPile.length === 0) return null;

        const tile = this.discardPile.pop();
        this.players[playerIndex].hand.push(tile);
        return tile;
    }

    // Taş at
    discardTile(playerId, tileId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1 || playerIndex !== this.currentPlayerIndex) return false;

        const hand = this.players[playerIndex].hand;
        const tileIndex = hand.findIndex(t => t.id === tileId);
        if (tileIndex === -1) return false;

        const tile = hand.splice(tileIndex, 1)[0];
        this.discardPile.push(tile);

        // Sıra sonraki oyuncuya geçer
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;

        return true;
    }

    // Taş okey mi kontrol et
    isOkey(tile) {
        if (tile.isFakeOkey) return true;
        return tile.color === this.okey.color && tile.number === this.okey.number;
    }

    // Eli kontrol et (geçerli mi?)
    checkHand(hand) {
        // 14 taş olmalı
        if (hand.length !== 14) return { valid: false, reason: 'Hand must have 14 tiles' };

        // Tüm kombinasyonları dene
        const result = this.findValidCombination(hand);
        return result;
    }

    // Geçerli kombinasyon bul
    findValidCombination(tiles) {
        // 7 çift kontrolü
        if (this.checkSevenPairs(tiles)) {
            return { valid: true, type: 'seven_pairs' };
        }

        // Per + çift kontrolü (3 per + 1 çift veya farklı kombinasyonlar)
        if (this.checkSetsAndRuns(tiles)) {
            return { valid: true, type: 'sets_and_runs' };
        }

        return { valid: false, reason: 'No valid combination found' };
    }

    // 7 çift kontrolü
    checkSevenPairs(tiles) {
        const sorted = [...tiles].sort((a, b) => {
            if (a.color !== b.color) return a.color.localeCompare(b.color);
            return a.number - b.number;
        });

        let pairs = 0;
        let okeyCount = tiles.filter(t => this.isOkey(t)).length;
        let i = 0;

        while (i < sorted.length) {
            if (this.isOkey(sorted[i])) {
                i++;
                continue;
            }

            if (i + 1 < sorted.length && 
                sorted[i].color === sorted[i + 1].color && 
                sorted[i].number === sorted[i + 1].number) {
                pairs++;
                i += 2;
            } else if (okeyCount > 0) {
                pairs++;
                okeyCount--;
                i++;
            } else {
                return false;
            }
        }

        return pairs + Math.floor(okeyCount / 2) >= 7;
    }

    // Per ve seri kontrolü
    checkSetsAndRuns(tiles) {
        // Basit kontrol: recursif olarak geçerli gruplar bulunmaya çalışılır
        return this.tryFormGroups([...tiles], []);
    }

    tryFormGroups(remaining, groups) {
        // Okeyleri ayır
        const okeys = remaining.filter(t => this.isOkey(t));
        const normalTiles = remaining.filter(t => !this.isOkey(t));

        if (normalTiles.length === 0 && okeys.length === 0) {
            // Tüm gruplar geçerli mi kontrol et
            return groups.every(g => g.length >= 3);
        }

        if (normalTiles.length === 0) {
            // Sadece okeyler kaldı, gruplara eklenebilir mi?
            return okeys.length % 3 === 0 || groups.some(g => g.length + okeys.length >= 3);
        }

        // İlk taşı al ve gruplar oluşturmayı dene
        const firstTile = normalTiles[0];
        const restTiles = normalTiles.slice(1);

        // 1. Aynı sayı farklı renk (set)
        const sameNumberTiles = normalTiles.filter(t => 
            t.number === firstTile.number && t.color !== firstTile.color
        );

        if (sameNumberTiles.length >= 2) {
            // 3'lü veya 4'lü set oluştur
            for (let len = 2; len <= Math.min(3, sameNumberTiles.length); len++) {
                const set = [firstTile, ...sameNumberTiles.slice(0, len)];
                const newRemaining = remaining.filter(t => !set.includes(t));
                if (this.tryFormGroups(newRemaining, [...groups, set])) {
                    return true;
                }
            }
        }

        // 2. Aynı renk ardışık sayılar (run)
        const sameColorTiles = normalTiles.filter(t => t.color === firstTile.color);
        const sortedByNumber = sameColorTiles.sort((a, b) => a.number - b.number);
        
        // Ardışık seri bul
        const run = [firstTile];
        for (let i = 0; i < sortedByNumber.length; i++) {
            const next = sortedByNumber.find(t => 
                t.number === run[run.length - 1].number + 1 && !run.includes(t)
            );
            if (next) {
                run.push(next);
            } else {
                break;
            }
        }

        if (run.length >= 3) {
            for (let len = 3; len <= run.length; len++) {
                const subset = run.slice(0, len);
                const newRemaining = remaining.filter(t => !subset.includes(t));
                if (this.tryFormGroups(newRemaining, [...groups, subset])) {
                    return true;
                }
            }
        }

        // 3. Okey kullanarak grup tamamla
        if (okeys.length > 0) {
            // Set tamamla
            if (sameNumberTiles.length >= 1) {
                const set = [firstTile, ...sameNumberTiles.slice(0, 1), okeys[0]];
                const newRemaining = remaining.filter(t => !set.includes(t));
                if (this.tryFormGroups(newRemaining, [...groups, set])) {
                    return true;
                }
            }

            // Run tamamla
            if (run.length >= 2) {
                const runWithOkey = [...run.slice(0, 2), okeys[0]];
                const newRemaining = remaining.filter(t => !runWithOkey.includes(t));
                if (this.tryFormGroups(newRemaining, [...groups, runWithOkey])) {
                    return true;
                }
            }
        }

        // Hiçbiri çalışmadıysa, bu taşı atla ve devam et
        return false;
    }

    // Oyunu bitir
    finishGame(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return null;

        const hand = this.players[playerIndex].hand;
        const result = this.checkHand(hand);

        if (!result.valid) {
            return { success: false, reason: result.reason };
        }

        // Skor hesapla
        const score = this.calculateScore(playerId, result.type);
        this.winner = {
            playerId,
            playerName: this.players[playerIndex].name,
            score,
            type: result.type
        };

        this.gameStarted = false;
        return { success: true, winner: this.winner };
    }

    // Skor hesapla
    calculateScore(playerId, winType) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return 0;

        let baseScore = 100;
        const hand = player.hand;

        // Sahte okey bonusu: Gerçek okeyi kullanmadan kazanırsa
        const realOkeyUsed = hand.some(t => 
            !t.isFakeOkey && t.color === this.okey.color && t.number === this.okey.number
        );
        const fakeOkeyUsed = hand.some(t => t.isFakeOkey);

        if (!realOkeyUsed && fakeOkeyUsed) {
            baseScore += 50; // Sahte okey bonusu
        }

        // Çift okey bonusu: 2 gerçek okey ile bitirme
        const realOkeyCount = hand.filter(t => 
            !t.isFakeOkey && t.color === this.okey.color && t.number === this.okey.number
        ).length;

        if (realOkeyCount === 2) {
            baseScore += 100; // Çift okey bonusu
        }

        // 7 çift bonusu
        if (winType === 'seven_pairs') {
            baseScore += 50;
        }

        return baseScore;
    }

    // Oyun durumunu al
    getGameState(playerId = null) {
        const state = {
            roomId: this.roomId,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                tileCount: p.hand.length,
                isReady: p.isReady
            })),
            currentPlayerIndex: this.currentPlayerIndex,
            currentPlayerId: this.players[this.currentPlayerIndex]?.id,
            gameStarted: this.gameStarted,
            indicator: this.indicator,
            okey: this.okey,
            centerTilesCount: this.centerTiles.length,
            discardPile: this.discardPile.slice(-1), // Son atılan taş
            winner: this.winner
        };

        // Oyuncunun kendi elini ekle
        if (playerId) {
            const player = this.players.find(p => p.id === playerId);
            if (player) {
                state.myHand = player.hand;
            }
        }

        return state;
    }
}

module.exports = { OkeyGame, COLORS, NUMBERS };
