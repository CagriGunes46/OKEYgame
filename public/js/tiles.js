/**
 * Tiles Module
 * Taş oluşturma, render ve sürükle-bırak işlemleri
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

    // Sürüklenen taş bilgisi
    draggedTileId: null,

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

    // Elde taşları render et (drag-drop destekli)
    renderHand(container, tiles, okey, options = {}) {
        container.innerHTML = '';

        tiles.forEach((tile, index) => {
            const isOkey = !tile.isFakeOkey &&
                okey &&
                tile.color === okey.color &&
                tile.number === okey.number;

            const tileEl = this.createTileElement(tile, index, { isOkey });

            // Click handler - taş atmak için
            tileEl.addEventListener('click', () => {
                if (options.onSelect) {
                    options.onSelect(tile, tileEl);
                }
            });

            // Drag start
            tileEl.draggable = true;
            tileEl.addEventListener('dragstart', (e) => {
                this.draggedTileId = tile.id;
                tileEl.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                // Küçük gecikme ile görselliği iyileştir
                setTimeout(() => {
                    tileEl.style.opacity = '0.4';
                }, 0);
            });

            // Drag end
            tileEl.addEventListener('dragend', () => {
                tileEl.classList.remove('dragging');
                tileEl.style.opacity = '1';
                this.draggedTileId = null;
                // Tüm göstergeleri temizle
                container.querySelectorAll('.tile').forEach(t => {
                    t.classList.remove('drag-over-left', 'drag-over-right');
                });
            });

            // Drag over - üzerinden geçerken
            tileEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.draggedTileId === null || this.draggedTileId === tile.id) return;

                const rect = tileEl.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;

                // Önceki göstergeleri temizle
                container.querySelectorAll('.tile').forEach(t => {
                    if (t !== tileEl) {
                        t.classList.remove('drag-over-left', 'drag-over-right');
                    }
                });

                // Yeni göstergeyi ekle
                if (e.clientX < midX) {
                    tileEl.classList.add('drag-over-left');
                    tileEl.classList.remove('drag-over-right');
                } else {
                    tileEl.classList.add('drag-over-right');
                    tileEl.classList.remove('drag-over-left');
                }
            });

            // Drag leave
            tileEl.addEventListener('dragleave', () => {
                tileEl.classList.remove('drag-over-left', 'drag-over-right');
            });

            // Drop
            tileEl.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.draggedTileId === null || this.draggedTileId === tile.id) return;

                const rect = tileEl.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                const insertBefore = e.clientX < midX;

                tileEl.classList.remove('drag-over-left', 'drag-over-right');

                if (options.onReorder) {
                    options.onReorder(this.draggedTileId, tile.id, insertBefore);
                }
            });

            container.appendChild(tileEl);
        });

        // Container'a drop (en sona eklemek için)
        container.ondragover = (e) => e.preventDefault();
        container.ondrop = (e) => {
            if (e.target === container && this.draggedTileId !== null && options.onReorder) {
                options.onReorder(this.draggedTileId, null, false);
            }
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

    // Taşları sırala
    sortTiles(tiles, sortBy = 'color') {
        const colorOrder = { yellow: 0, blue: 1, black: 2, red: 3, fake: 4 };

        return [...tiles].sort((a, b) => {
            if (sortBy === 'color') {
                if (a.isFakeOkey) return 1;
                if (b.isFakeOkey) return -1;

                const colorDiff = colorOrder[a.color] - colorOrder[b.color];
                if (colorDiff !== 0) return colorDiff;
                return a.number - b.number;
            } else if (sortBy === 'number') {
                if (a.isFakeOkey) return 1;
                if (b.isFakeOkey) return -1;

                const numDiff = a.number - b.number;
                if (numDiff !== 0) return numDiff;
                return colorOrder[a.color] - colorOrder[b.color];
            }
            return 0;
        });
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
