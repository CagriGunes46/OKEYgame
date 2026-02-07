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

    // Sürükleme durumu
    dragState: {
        draggedTile: null,
        draggedElement: null
    },

    // Taş elementi oluştur
    createTileElement(tile, options = {}) {
        const tileEl = document.createElement('div');
        tileEl.className = 'tile';
        tileEl.dataset.tileId = tile.id;
        tileEl.dataset.tileIndex = options.index ?? 0;

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

        // Click handler
        if (options.selectable) {
            tileEl.addEventListener('click', (e) => {
                // Sürükleme sırasında click'i engelle
                if (this.dragState.draggedTile) return;
                if (options.onSelect) {
                    options.onSelect(tile, tileEl);
                }
            });
        }

        // Drag & drop sıralama için
        if (options.draggable && options.onReorder) {
            tileEl.draggable = true;

            tileEl.addEventListener('dragstart', (e) => {
                this.dragState.draggedTile = tile;
                this.dragState.draggedElement = tileEl;
                tileEl.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', tile.id);
            });

            tileEl.addEventListener('dragend', (e) => {
                tileEl.classList.remove('dragging');
                this.clearDragIndicators();
                this.dragState.draggedTile = null;
                this.dragState.draggedElement = null;
            });

            tileEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (this.dragState.draggedElement && this.dragState.draggedElement !== tileEl) {
                    const rect = tileEl.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;

                    // Farenin konumuna göre sola veya sağa yerleştir
                    if (e.clientX < midX) {
                        tileEl.classList.add('drag-left');
                        tileEl.classList.remove('drag-right');
                    } else {
                        tileEl.classList.add('drag-right');
                        tileEl.classList.remove('drag-left');
                    }
                }
            });

            tileEl.addEventListener('dragleave', (e) => {
                tileEl.classList.remove('drag-left', 'drag-right');
            });

            tileEl.addEventListener('drop', (e) => {
                e.preventDefault();
                tileEl.classList.remove('drag-left', 'drag-right');

                if (this.dragState.draggedTile && this.dragState.draggedTile.id !== tile.id) {
                    const rect = tileEl.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;
                    const insertBefore = e.clientX < midX;

                    if (options.onReorder) {
                        options.onReorder(this.dragState.draggedTile, tile, insertBefore);
                    }
                }
            });
        }

        return tileEl;
    },

    // Drag göstergelerini temizle
    clearDragIndicators() {
        document.querySelectorAll('.tile.drag-left, .tile.drag-right').forEach(el => {
            el.classList.remove('drag-left', 'drag-right');
        });
    },

    // Elde taşları render et
    renderHand(container, tiles, okey, options = {}) {
        container.innerHTML = '';

        tiles.forEach((tile, index) => {
            const isOkey = !tile.isFakeOkey &&
                okey &&
                tile.color === okey.color &&
                tile.number === okey.number;

            const tileEl = this.createTileElement(tile, {
                ...options,
                index,
                isOkey,
                selectable: true,
                draggable: true
            });

            container.appendChild(tileEl);
        });

        // Container drop zone (en sona bırakma için)
        container.ondragover = (e) => e.preventDefault();
        container.ondrop = (e) => {
            if (e.target === container && this.dragState.draggedTile && options.onReorder) {
                options.onReorder(this.dragState.draggedTile, null, false);
            }
        };
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
            const tileEl = this.createTileElement(tile, { draggable: false });
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

            const tileEl = this.createTileElement(tile, { isOkey, draggable: false });
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

    // Taşı yeniden sırala
    reorderTiles(tiles, draggedTile, targetTile, insertBefore) {
        const newTiles = tiles.filter(t => t.id !== draggedTile.id);

        if (targetTile === null) {
            // En sona ekle
            newTiles.push(draggedTile);
        } else {
            const targetIndex = newTiles.findIndex(t => t.id === targetTile.id);
            if (targetIndex !== -1) {
                if (insertBefore) {
                    newTiles.splice(targetIndex, 0, draggedTile);
                } else {
                    newTiles.splice(targetIndex + 1, 0, draggedTile);
                }
            } else {
                newTiles.push(draggedTile);
            }
        }

        return newTiles;
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
    },

    // Seçili taşları al
    getSelectedTiles(container) {
        const selected = [];
        container.querySelectorAll('.tile.selected').forEach(el => {
            selected.push(parseInt(el.dataset.tileId));
        });
        return selected;
    }
};

// Global export
window.TileRenderer = TileRenderer;
