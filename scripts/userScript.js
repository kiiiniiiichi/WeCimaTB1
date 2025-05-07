// Install uBlock Origin core via npm
const { StaticNetFilteringEngine } = require('@gorhill/ubo-core');

// Load some common public filter lists
const easyListURL = 'https://easylist.to/easylist/easyList.txt';
const uboAdsURL = 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt';

async function fetchList(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return await response.text();
}

async function setupFilteringEngine() {
    const snfe = await StaticNetFilteringEngine.create();

    const [easyListText, uboAdsText] = await Promise.all([
        fetchList(easyListURL),
        fetchList(uboAdsURL)
    ]);

    await snfe.useLists([
        { raw: easyListText },
        { raw: uboAdsText }
    ]);

    return snfe;
}

// TV Remote Navigation Controller
class TVRemoteController {
    constructor() {
        this.items = [];
        this.focusedIndex = 0;
        this.columns = 3; // Default, can be changed based on layout
        this.isActive = false;
        
        // Key code mappings for various TV platforms
        this.keyMap = {
            // Standard arrow keys
            37: 'left',
            38: 'up',
            39: 'right',
            40: 'down',
            13: 'enter',
            27: 'back',
            
            // Samsung Tizen
            10009: 'back',
            10252: 'enter',
            
        
        };
    }
    
    init(selector = '.focusable', columns = 3) {
        this.items = Array.from(document.querySelectorAll(selector));
        this.columns = columns;
        this.isActive = true;
        
        if (this.items.length > 0) {
            this.updateFocus();
            this.setupEventListeners();
        }
        
        return this;
    }
    
    updateFocus() {
        // Remove focus from all items
        this.items.forEach(item => {
            item.classList.remove('focused');
            item.setAttribute('aria-selected', 'false');
        });
        
        // Add focus to current item
        if (this.items[this.focusedIndex]) {
            const focusedItem = this.items[this.focusedIndex];
            focusedItem.classList.add('focused');
            focusedItem.setAttribute('aria-selected', 'true');
            focusedItem.focus();
            
            // Scroll into view if needed
            focusedItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }
    
    moveFocus(direction) {
        if (!this.isActive || this.items.length === 0) return;
        
        const lastIndex = this.items.length - 1;
        const rowStart = Math.floor(this.focusedIndex / this.columns) * this.columns;
        const rowEnd = Math.min(rowStart + this.columns - 1, lastIndex);
        
        switch (direction) {
            case 'left':
                this.focusedIndex = (this.focusedIndex % this.columns !== 0) ? 
                    this.focusedIndex - 1 : 
                    rowEnd;
                break;
                
            case 'right':
                this.focusedIndex = ((this.focusedIndex + 1) % this.columns !== 0 && 
                                    this.focusedIndex < lastIndex) ? 
                    this.focusedIndex + 1 : 
                    rowStart;
                break;
                
            case 'up':
                if (this.focusedIndex - this.columns >= 0) {
                    this.focusedIndex -= this.columns;
                } else {
                    // Wrap to bottom of previous column
                    const col = this.focusedIndex % this.columns;
                    const lastRowStart = Math.floor(lastIndex / this.columns) * this.columns;
                    this.focusedIndex = Math.min(lastRowStart + col, lastIndex);
                }
                break;
                
            case 'down':
                if (this.focusedIndex + this.columns < this.items.length) {
                    this.focusedIndex += this.columns;
                } else {
                    // Wrap to top of next column
                    const col = this.focusedIndex % this.columns;
                    this.focusedIndex = col;
                }
                break;
                
            case 'home':
                this.focusedIndex = 0;
                break;
                
            case 'end':
                this.focusedIndex = lastIndex;
                break;
        }
        
        this.updateFocus();
    }
    
    activateFocusedItem() {
        if (this.isActive && this.items[this.focusedIndex]) {
            const focusedItem = this.items[this.focusedIndex];
            focusedItem.click();
            
            // Dispatch enter event for custom handling
            const event = new CustomEvent('tv-enter', { 
                detail: { element: focusedItem }
            });
            document.dispatchEvent(event);
        }
    }
    
    handleBack() {
        // Dispatch back event for custom handling
        const event = new CustomEvent('tv-back');
        document.dispatchEvent(event);
        
        // Default back behavior
        if (window.history.length > 1) {
            window.history.back();
        } else if (typeof tizen !== 'undefined') {
            tizen.application.getCurrentApplication().exit();
        }
    }
    
    setupEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            
            const action = this.keyMap[e.keyCode];
            
            if (action) {
                e.preventDefault();
                e.stopPropagation();
                
                switch (action) {
                    case 'left':
                    case 'right':
                    case 'up':
                    case 'down':
                        this.moveFocus(action);
                        break;
                        
                    case 'enter':
                        this.activateFocusedItem();
                        break;
                        
                    case 'back':
                        this.handleBack();
                        break;
                }
            }
        });
        
        // Mouse/touch support - transfer focus on interaction
        this.items.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.focusedIndex = index;
                this.updateFocus();
            });
            
            item.addEventListener('focus', () => {
                if (!item.classList.contains('focused')) {
                    this.focusedIndex = index;
                    this.updateFocus();
                }
            });
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the remote controller
    const remote = new TVRemoteController().init();
    
    // Add CSS for focus state if not already present
    if (!document.getElementById('tv-navigation-styles')) {
        const style = document.createElement('style');
        style.id = 'tv-navigation-styles';
        style.textContent = `
            .focusable.focused {
                outline: 3px solid #00a8ff !important;
                transform: scale(1.05);
                transition: transform 0.2s ease;
                z-index: 10;
            }
            
            .focusable {
                outline: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Custom event listeners
    document.addEventListener('tv-enter', (e) => {
        console.log('Enter pressed on', e.detail.element);
        // Add custom enter handling here
    });
    
    document.addEventListener('tv-back', () => {
        console.log('Back button pressed');
        // Add custom back handling here
    });
});

// Apply the filter list as needed in your application
setupFilteringEngine().then(snfe => {
    console.log('Filtering engine ready');
    // Use snfe to check requests or apply filters
});
