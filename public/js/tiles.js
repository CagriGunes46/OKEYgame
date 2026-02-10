/**
 * Tiles Module
 * Taş oluşturma, render ve sürükle-bırak işlemleri
 * Hem masaüstü (drag) hem mobil (touch) desteği
 */

const TileRenderer = {
    // Renk isimleri (Türkçe)
    colorNames: {
        yellow: 'Sarı',
        blue: 'Mavi',
        black: 'Siyah',
        red: 'Kırmızı',
        fake: 'Sahte Okey'
    },

    // Sürükleme durumu
    dragState: {
        active: false,
        tileId: null,
        tileEl: null,
        ghostEl: null,
        startX: 0,
        startY: 0,
        longPressTimer: null,
        container: null,
        options: null
    },

    // Taş elementi oluştur
    createTileElement(tile, index, options = {}) {
        const tileEl = document.createElement('div');
        tileEl.className = 'tile';
        tileEl.dataset.tileId = tile.id;
        tileEl.dataset.index = index;

        if (tile.isFakeOkey) {
            tileEl.classList.add('fake');
        } else {
            tileEl.classList.add(tile.color);
            tileEl.innerHTML = `
                <span class="tile-number">${tile.number}</span>
                <div class="tile-color-dot"></div>
            `;
        }

        // Okey işareti
        if (options.isOkey) {
            tileEl.classList.add('okey');
        }

        return tileEl;
    },

    // Elde taşları render et (drag-drop + touch destekli)
    renderHand(container, tiles, okey, options = {}) {
        container.innerHTML = '';

        tiles.forEach((tile, index) => {
            const isOkey = !tile.isFakeOkey &&
                okey &&
                tile.color === okey.color &&
                tile.number === okey.number;

            const tileEl = this.createTileElement(tile, index, { isOkey });

            // ========== CLICK (taş seçme/atma) ==========
            let clickAllowed = true;
            tileEl.addEventListener('click', (e) => {
                if (!clickAllowed) return;
                if (options.onSelect) {
                    options.onSelect(tile, tileEl);
                }
            });

            // ========== MASAÜSTÜ DRAG & DROP ==========
            tileEl.draggable = true;
            tileEl.addEventListener('dragstart', (e) => {
                clickAllowed = false;
                this.dragState.tileId = tile.id;
                tileEl.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { tileEl.style.opacity = '0.4'; }, 0);
            });

            tileEl.addEventListener('dragend', () => {
                tileEl.classList.remove('dragging');
                tileEl.style.opacity = '1';
                this.dragState.tileId = null;
                container.querySelectorAll('.tile').forEach(t => {
                    t.classList.remove('drag-over-left', 'drag-over-right');
                });
                setTimeout(() => { clickAllowed = true; }, 50);
            });

            tileEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.dragState.tileId === null || this.dragState.tileId === tile.id) return;
                const rect = tileEl.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                container.querySelectorAll('.tile').forEach(t => {
                    if (t !== tileEl) t.classList.remove('drag-over-left', 'drag-over-right');
                });
                if (e.clientX < midX) {
                    tileEl.classList.add('drag-over-left');
                    tileEl.classList.remove('drag-over-right');
                } else {
                    tileEl.classList.add('drag-over-right');
                    tileEl.classList.remove('drag-over-left');
                }
            });

            tileEl.addEventListener('dragleave', () => {
                tileEl.classList.remove('drag-over-left', 'drag-over-right');
            });

            tileEl.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.dragState.tileId === null || this.dragState.tileId === tile.id) return;
                const rect = tileEl.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                const insertBefore = e.clientX < midX;
                tileEl.classList.remove('drag-over-left', 'drag-over-right');
                if (options.onReorder) {
                    options.onReorder(this.dragState.tileId, tile.id, insertBefore);
                }
            });

            // ========== MOBİL TOUCH DRAG & DROP ==========
            tileEl.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                this.dragState.startX = touch.clientX;
                this.dragState.startY = touch.clientY;

                // Uzun basma ile sürükleme başlat (300ms)
                this.dragState.longPressTimer = setTimeout(() => {
                    clickAllowed = false;
                    e.preventDefault();
                    this.startTouchDrag(tileEl, tile, touch, container, options);
                }, 300);
            }, { passive: false });

            tileEl.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - this.dragState.startX);
                const dy = Math.abs(touch.clientY - this.dragState.startY);

                // Hareket varsa ve henüz drag başlamadıysa, uzun basma iptal
                if (!this.dragState.active && (dx > 10 || dy > 10)) {
                    clearTimeout(this.dragState.longPressTimer);
                    // Hızlı hareketle de sürükleme başlat
                    if (dx > 15) {
                        clickAllowed = false;
                        e.preventDefault();
                        this.startTouchDrag(tileEl, tile, touch, container, options);
                    }
                }

                // Sürükleme devam ediyorsa
                if (this.dragState.active) {
                    e.preventDefault();
                    this.moveTouchDrag(touch, container);
                }
            }, { passive: false });

            tileEl.addEventListener('touchend', (e) => {
                clearTimeout(this.dragState.longPressTimer);
                if (this.dragState.active) {
                    e.preventDefault();
                    this.endTouchDrag(container, options);
                }
                setTimeout(() => { clickAllowed = true; }, 100);
            });

            tileEl.addEventListener('touchcancel', () => {
                clearTimeout(this.dragState.longPressTimer);
                this.cancelTouchDrag(container);
            });

            container.appendChild(tileEl);
        });

        // Container'a drop (masaüstü - en sona eklemek için)
        container.ondragover = (e) => e.preventDefault();
        container.ondrop = (e) => {
            if (e.target === container && this.dragState.tileId !== null && options.onReorder) {
                options.onReorder(this.dragState.tileId, null, false);
            }
        };
    },

    // ========== TOUCH DRAG YARDIMCI FONKSİYONLARI ==========

    // Touch sürükleme başlat
    startTouchDrag(tileEl, tile, touch, container, options) {
        if (this.dragState.active) return;
        this.dragState.active = true;
        this.dragState.tileId = tile.id;
        this.dragState.tileEl = tileEl;
        this.dragState.container = container;
        this.dragState.options = options;

        // Haptic feedback (mümkünse)
        if (navigator.vibrate) navigator.vibrate(30);

        // Orijinal taşı gölgele
        tileEl.classList.add('dragging');

        // Ghost element oluştur (parmağın altında takip eden kopya)
        const ghost = tileEl.cloneNode(true);
        ghost.classList.add('tile-ghost');
        ghost.classList.remove('dragging');
        ghost.style.cssText = `
            position: fixed;
            z-index: 10000;
            pointer-events: none;
            opacity: 0.85;
            transform: scale(1.15);
            box-shadow: 0 8px 25px rgba(0,0,0,0.5);
            transition: none;
            left: ${touch.clientX - 25}px;
            top: ${touch.clientY - 35}px;
        `;
        document.body.appendChild(ghost);
        this.dragState.ghostEl = ghost;
    },

    // Touch sürükleme hareketi
    moveTouchDrag(touch, container) {
        // Ghost'u parmağa takip ettir
        if (this.dragState.ghostEl) {
            this.dragState.ghostEl.style.left = `${touch.clientX - 25}px`;
            this.dragState.ghostEl.style.top = `${touch.clientY - 35}px`;
        }

        // Üzerinden geçilen taşı bul
        const tiles = container.querySelectorAll('.tile:not(.dragging)');
        let foundTarget = false;

        tiles.forEach(t => {
            const rect = t.getBoundingClientRect();
            const inBounds = touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top - 20 && touch.clientY <= rect.bottom + 20;

            if (inBounds) {
                foundTarget = true;
                const midX = rect.left + rect.width / 2;
                t.classList.remove('drag-over-left', 'drag-over-right');
                if (touch.clientX < midX) {
                    t.classList.add('drag-over-left');
                } else {
                    t.classList.add('drag-over-right');
                }
            } else {
                t.classList.remove('drag-over-left', 'drag-over-right');
            }
        });
    },

    // Touch sürükleme bitir
    endTouchDrag(container, options) {
        if (!this.dragState.active) return;

        // Hedef taşı bul (göstergesi olan)
        const targetTile = container.querySelector('.tile.drag-over-left, .tile.drag-over-right');

        if (targetTile && options.onReorder) {
            const targetId = parseInt(targetTile.dataset.tileId);
            const insertBefore = targetTile.classList.contains('drag-over-left');
            options.onReorder(this.dragState.tileId, targetId, insertBefore);
        }

        this.cancelTouchDrag(container);
    },

    // Touch sürükleme iptal
    cancelTouchDrag(container) {
        // Ghost'u kaldır
        if (this.dragState.ghostEl) {
            this.dragState.ghostEl.remove();
        }

        // Tüm göstergeleri temizle
        if (container) {
            container.querySelectorAll('.tile').forEach(t => {
                t.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
                t.style.opacity = '1';
            });
        }

        // Durumu sıfırla
        this.dragState = {
            active: false,
            tileId: null,
            tileEl: null,
            ghostEl: null,
            startX: 0,
            startY: 0,
            longPressTimer: null,
            container: null,
            options: null
        };
    },

    // Taşları yeniden sırala (ID'lerle çalışır)
    reorderTilesById(tiles, draggedId, targetId, insertBefore) {
        const draggedTile = tiles.find(t => t.id === draggedId);
        if (!draggedTile) return tiles;

        // Sürüklenen taşı çıkar
        const newTiles = tiles.filter(t => t.id !== draggedId);

        if (targetId === null) {
            // En sona ekle
            newTiles.push(draggedTile);
        } else {
            // Hedef konuma ekle
            const targetIndex = newTiles.findIndex(t => t.id === targetId);
            if (targetIndex !== -1) {
                const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
                newTiles.splice(insertIndex, 0, draggedTile);
            } else {
                newTiles.push(draggedTile);
            }
        }

        return newTiles;
    },

    // Rakip taşlarını render et (arka yüz)
    renderOpponentTiles(container, count) {
        container.innerHTML = '';

        for (let i = 0; i < count; i++) {
            const tileEl = document.createElement('div');
            tileEl.className = 'opponent-tile';
            container.appendChild(tileEl);
        }
    },

    // Gösterge taşını render et
    renderIndicator(container, tile) {
        container.innerHTML = '';

        if (tile) {
            const tileEl = this.createTileElement(tile, 0, {});
            tileEl.draggable = false;
            tileEl.style.cursor = 'default';
            container.appendChild(tileEl);
        }
    },

    // Atılan taşı render et
    renderDiscardedTile(container, tile, okey) {
        container.innerHTML = '';

        if (tile) {
            const isOkey = !tile.isFakeOkey &&
                okey &&
                tile.color === okey.color &&
                tile.number === okey.number;

            const tileEl = this.createTileElement(tile, 0, { isOkey });
            tileEl.draggable = false;
            tileEl.style.cursor = 'default';
            container.appendChild(tileEl);
        }
    },

    // Taşları sırala - Okey kurallarına göre (önce renk, sonra sayı)
    sortTiles(tiles, sortBy = 'color') {
        const colorOrder = { yellow: 0, blue: 1, black: 2, red: 3 };

        return [...tiles].sort((a, b) => {
            // Sahte okey her zaman sona
            if (a.isFakeOkey && b.isFakeOkey) return 0;
            if (a.isFakeOkey) return 1;
            if (b.isFakeOkey) return -1;

            if (sortBy === 'color') {
                const colorDiff = colorOrder[a.color] - colorOrder[b.color];
                if (colorDiff !== 0) return colorDiff;
                return a.number - b.number;
            } else if (sortBy === 'number') {
                const numDiff = a.number - b.number;
                if (numDiff !== 0) return numDiff;
                return colorOrder[a.color] - colorOrder[b.color];
            }
            return 0;
        });
    },

    // Akıllı sıralama - Gerçek per, seri ve çiftleri bulup gruplar
    smartSortTiles(tiles, okey = null) {
        const colorOrder = { yellow: 0, blue: 1, black: 2, red: 3 };

        // Sahte okeyleri ayır
        const fakeOkeys = tiles.filter(t => t.isFakeOkey);
        const normalTiles = tiles.filter(t => !t.isFakeOkey);

        // Okeyleri (joker) ayır
        const okeyTiles = okey ? normalTiles.filter(t =>
            t.color === okey.color && t.number === okey.number
        ) : [];

        let remaining = okey ? normalTiles.filter(t =>
            !(t.color === okey.color && t.number === okey.number)
        ) : [...normalTiles];

        const groups = { runs: [], sets: [], pairs: [], singles: [] };

        // 1. ADIM: Serileri bul (aynı renk, ardışık sayılar) - en uzundan başla
        const colors = ['yellow', 'blue', 'black', 'red'];
        for (const color of colors) {
            let colorTiles = remaining
                .filter(t => t.color === color)
                .sort((a, b) => a.number - b.number);

            while (colorTiles.length >= 3) {
                // En uzun seriyi bul
                let bestRun = [];
                for (let startIdx = 0; startIdx < colorTiles.length; startIdx++) {
                    const run = [colorTiles[startIdx]];
                    for (let j = startIdx + 1; j < colorTiles.length; j++) {
                        if (colorTiles[j].number === run[run.length - 1].number + 1) {
                            run.push(colorTiles[j]);
                        } else if (colorTiles[j].number > run[run.length - 1].number + 1) {
                            break;
                        }
                    }
                    if (run.length > bestRun.length) {
                        bestRun = run;
                    }
                }

                if (bestRun.length >= 3) {
                    groups.runs.push(bestRun);
                    const usedIds = new Set(bestRun.map(t => t.id));
                    remaining = remaining.filter(t => !usedIds.has(t.id));
                    colorTiles = colorTiles.filter(t => !usedIds.has(t.id));
                } else {
                    break;
                }
            }
        }

        // 2. ADIM: Perleri bul (aynı sayı, farklı renkler)
        const numberGroups = {};
        remaining.forEach(t => {
            if (!numberGroups[t.number]) numberGroups[t.number] = [];
            numberGroups[t.number].push(t);
        });

        for (const num in numberGroups) {
            const sameTiles = numberGroups[num];
            // Farklı renklerden 3+ taş varsa per
            const uniqueByColor = [];
            const usedC = new Set();
            for (const t of sameTiles) {
                if (!usedC.has(t.color)) {
                    uniqueByColor.push(t);
                    usedC.add(t.color);
                }
            }

            if (uniqueByColor.length >= 3) {
                groups.sets.push(uniqueByColor);
                const usedIds = new Set(uniqueByColor.map(t => t.id));
                remaining = remaining.filter(t => !usedIds.has(t.id));
            }
        }

        // 3. ADIM: Çiftleri bul
        const pairCheck = {};
        const toRemoveFromRemaining = [];
        remaining.forEach(t => {
            const key = `${t.color}-${t.number}`;
            if (!pairCheck[key]) pairCheck[key] = [];
            pairCheck[key].push(t);
        });

        for (const key in pairCheck) {
            if (pairCheck[key].length >= 2) {
                groups.pairs.push(pairCheck[key].slice(0, 2));
                const usedIds = new Set(pairCheck[key].slice(0, 2).map(t => t.id));
                toRemoveFromRemaining.push(...usedIds);
            }
        }
        const removeSet = new Set(toRemoveFromRemaining);
        remaining = remaining.filter(t => !removeSet.has(t.id));

        // 4. ADIM: Kalan tekil taşları renge göre sırala
        remaining.sort((a, b) => {
            const cd = colorOrder[a.color] - colorOrder[b.color];
            if (cd !== 0) return cd;
            return a.number - b.number;
        });

        // Sonucu birleştir: Seriler → Perler → Çiftler → Tekil → Okey → Sahte Okey
        const result = [];
        groups.runs.forEach(run => result.push(...run));
        groups.sets.forEach(set => result.push(...set));
        groups.pairs.forEach(pair => result.push(...pair));
        result.push(...remaining);
        result.push(...okeyTiles);
        result.push(...fakeOkeys);

        return result;
    },

    // Seçili taşı değiştir
    toggleTileSelection(tileEl) {
        tileEl.classList.toggle('selected');
    },

    // Tüm seçimleri temizle
    clearSelections(container) {
        container.querySelectorAll('.tile.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }
};

// Global export
window.TileRenderer = TileRenderer;
