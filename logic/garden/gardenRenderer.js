/**
 * Garden renderer module
 * Handles rendering the Tiled map and plant sprites using HTML/CSS
 */

import { getPlantStage, getPlantSprite, getSpriteBackgroundPosition } from './plantGrowth.js';

/**
 * Map configuration - loaded from assets/gardenMap.tmj
 */
let mapData = null;
let tilesets = null;

const mapUrl = chrome.runtime.getURL(
    'assets/'
);

/**
 * Load and parse the Tiled map
 * @returns {Promise<Object>} Map data
 */
export async function loadMapData() {
  if (mapData) {
    return mapData;
  }

  try {
    const response = await fetch(mapUrl + 'gardenMap.tmj');
    if (!response.ok) {
      throw new Error(`Failed to load map: ${response.status}`);
    }
    
    mapData = await response.json();
    
    // Validate map structure
    if (!mapData.layers || !Array.isArray(mapData.layers)) {
      throw new Error('Invalid map data: missing layers');
    }
    
    if (!mapData.width || !mapData.height) {
      throw new Error('Invalid map data: missing dimensions');
    }
    
    return mapData;
  } catch (error) {
    console.error('Error loading map:', error);
    throw error;
  }
}

/**
 * Get the plantable layer from the map
 * @returns {Object|null} Plantable layer or null if not found
 */
export function getPlantableLayer() {
  if (!mapData) return null;
  return mapData.layers.find(layer => layer.name === 'Plantable') || null;
}

/**
 * Check if a tile is plantable
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @returns {boolean} Whether the tile can accept plants
 */
export function isPlantableTile(tileX, tileY) {
  const plantableLayer = getPlantableLayer();
  if (!plantableLayer) {
    return false;
  }

  if (tileX < 0 || tileY < 0 || tileX >= mapData.width || tileY >= mapData.height) {
    return false;
  }

  const index = tileY * mapData.width + tileX;
  const tileId = plantableLayer.data[index];
  
  // Tile ID 0 means no tile/not plantable
  return tileId !== 0;
}

/**
 * Render the map into a container
 * @param {HTMLElement} container - Container element
 * @returns {Promise<void>}
 */
export async function renderMap(container) {
  try {
    const mapData = await loadMapData();
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create map tiles
    const width = mapData.width;
    const height = mapData.height;
    const tileSize = mapData.tilewidth || 32;
    
    // Set container dimensions to fit the map
    const containerWidth = width * tileSize;
    const containerHeight = height * tileSize;
    container.style.width = `${containerWidth}px`;
    container.style.height = `${containerHeight}px`;

    container.style.left = '50%';
    container.style.top = '50%';
    container.style.transform = 'translate(-50%, -50%)';

    const plantLayer = document.getElementById('plantLayer');

    plantLayer.style.left = '50%';
    plantLayer.style.top = '50%';
    plantLayer.style.transform = 'translate(-50%, -50%)';

    plantLayer.style.width = `${containerWidth}px`;
    plantLayer.style.height = `${containerHeight}px`;

    // Keep the animal layer perfectly aligned with the map
    const animalLayer = document.getElementById('animalLayer');
    if (animalLayer) {
      animalLayer.style.left      = '50%';
      animalLayer.style.top       = '50%';
      animalLayer.style.transform = 'translate(-50%, -50%)';
      animalLayer.style.width     = `${containerWidth}px`;
      animalLayer.style.height    = `${containerHeight}px`;
    }
    
    // Create tiles for the first visible layer (usually the base layer)
    const renderLayers = mapData.layers.filter(layer =>
        layer.type === 'tilelayer' &&
        layer.visible !== false
    );
        
    renderLayers.forEach((layer, layerIndex) => {
        renderLayerTiles(
            container,
            layer,
            mapData,
            tileSize,
            layerIndex
        );
    });
    
  } catch (error) {
    console.error('Error rendering map:', error);
    throw error;
  }
}

/**
 * Render tiles from a layer
 * @param {HTMLElement} container - Container element
 * @param {Object} layer - Layer data
 * @param {Object} mapData - Full map data
 * @param {number} tileSize - Size of each tile
 */

function getTilesetForGid(gid, tilesets) {
    let result = tilesets[0];

    for (const tileset of tilesets) {
        if (gid >= tileset.firstgid) {
            result = tileset;
        }
    }

    return result;
}

function renderLayerTiles(container, layer, mapData, tileSize) {
  const width = mapData.width;
  const height = mapData.height;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const tileId = layer.data[index];
      
      if (tileId === 0) continue; // Skip empty tiles
      
      const tile = document.createElement('div');
      tile.className = 'map-tile';
      tile.style.left = `${x * tileSize}px`;
      tile.style.top = `${y * tileSize}px`;
      
      // Set tile background based on first tileset
      if (mapData.tilesets && mapData.tilesets.length > 0) {
        const tileset = getTilesetForGid(tileId, mapData.tilesets);
        const spriteUrl = tileset.image.replace(/^\.\.\//, '');
        const imageUrl = chrome.runtime.getURL(`assets/${spriteUrl}`);
        
        // Calculate tile position in the tileset image
        const tileIndex = tileId - tileset.firstgid;
        const tilesPerRow = tileset.columns || Math.floor(tileset.imagewidth / tileset.tilewidth);
        const tileRow = Math.floor(tileIndex / tilesPerRow);
        const tileCol = tileIndex % tilesPerRow;
        
        const offsetX = tileCol * tileset.tilewidth;
        const offsetY = tileRow * tileset.tileheight;
        
        tile.style.backgroundImage = `url('${imageUrl}')`;

        tile.style.backgroundSize =
            `${tileset.imagewidth}px ${tileset.imageheight}px`;

        tile.style.backgroundPosition =
            `-${offsetX}px -${offsetY}px`;

        tile.style.backgroundRepeat = 'no-repeat';
        tile.style.backgroundImage = `url('${imageUrl}')`;
      }
      
      // Add class to plantable tiles so they can be clicked
      if (isPlantableTile(x, y)) {
        tile.className += ' plantable-tile';
        tile.dataset.tileX = x;
        tile.dataset.tileY = y;
      }
      
      container.appendChild(tile);
    }
  }
}

/**
 * Render plants into a container
 * @param {HTMLElement} plantLayer - Plant layer container
 * @param {Array} plants - Array of plant objects
 * @param {number} totalFocusMinutes - Total focus minutes for growth calculation
 */
export function renderPlants(plantLayer, plants, totalFocusMinutes) {
  try {
    // Clear existing plants
    plantLayer.innerHTML = '';
    
    if (!Array.isArray(plants) || plants.length === 0) {
      return;
    }
    
    const tileSize = 32; // From Tiled map
    
    plants.forEach(plant => {
      try {
        const stage = getPlantStage(plant, totalFocusMinutes);
        const sprite = getPlantSprite(plant.type, stage);
        const scale = 1;
        const scaledWidth = sprite.spriteWidth * scale;
        const scaledHeight = sprite.spriteHeight * scale;

        // Calculate plant position (centered on tile)
        const tileCenterX = plant.tileX * tileSize + tileSize / 2;
        const tileCenterY = plant.tileY * tileSize + tileSize / 2;

        const plantRenderX = tileCenterX - scaledWidth / 2;
        const plantRenderY = tileCenterY - scaledHeight / 2;
        
        // Create plant element
        const plantEl = document.createElement('div');
        plantEl.className = 'plant-sprite';
        plantEl.dataset.plantId = plant.id;
        plantEl.dataset.tileX = plant.tileX;
        plantEl.dataset.tileY = plant.tileY;
        plantEl.title = `${plant.type} (${sprite.stageName})`;
        
        // Position the plant

        plantEl.style.left = `${plantRenderX}px`;
        plantEl.style.top = `${plantRenderY}px`;
        plantEl.style.width = `${scaledWidth}px`;
        plantEl.style.height = `${scaledHeight}px`;
        
        // Set sprite image
        plantEl.style.backgroundImage = `url('${sprite.url}')`;
        
        // For sprite sheets, set the background position to show the correct frame
        const bgPos = getSpriteBackgroundPosition(sprite);
        plantEl.style.backgroundPosition = bgPos;
        plantEl.style.backgroundSize = `${sprite.stageCount * scaledWidth}px ${scaledHeight}px`;
        
        plantLayer.appendChild(plantEl);
      } catch (error) {
        console.warn('Failed to render plant:', plant, error);
      }
    });
    
  } catch (error) {
    console.error('Error rendering plants:', error);
  }
}

/**
 * Get tile coordinates from a click event on the map
 * @param {MouseEvent} event - Click event
 * @param {HTMLElement} mapContainer - Map container element
 * @returns {Object|null} {tileX, tileY} or null if not on a valid tile
 */
export function getTileFromEvent(event, mapContainer) {
  try {
    const rect = mapContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const tileSize = 32;
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);
    
    if (isPlantableTile(tileX, tileY)) {
      return { tileX, tileY };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting tile from event:', error);
    return null;
  }
}

/**
 * Get map dimensions
 * @returns {Object} {width, height, tileWidth, tileHeight}
 */
export function getMapDimensions() {
  if (!mapData) {
    return { width: 0, height: 0, tileWidth: 32, tileHeight: 32 };
  }
  
  return {
    width: mapData.width,
    height: mapData.height,
    tileWidth: mapData.tilewidth || 32,
    tileHeight: mapData.tileheight || 32
  };
}

export default {
  loadMapData,
  getPlantableLayer,
  isPlantableTile,
  renderMap,
  renderPlants,
  getTileFromEvent,
  getMapDimensions
};