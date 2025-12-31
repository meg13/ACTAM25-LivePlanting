// Dynamic Table of Contents Generator - HOVER ONLY

class HoverTableOfContents {
  /**
   * Constructor - Initialize the hover TOC generator
   * @param {string} triggerSelector - CSS selector for the hover trigger area
   * @param {array} headingLevels - Array of heading levels to include (h1, h2, etc.)
   * @param {string} tocId - ID for the TOC container element
   */
  constructor(triggerSelector = '#toc-trigger', headingLevels = ['h1', 'h2', 'h3', 'h4'], tocId = 'toc-container') {
    this.triggerSelector = triggerSelector;
    this.headingLevels = headingLevels;
    this.tocId = tocId;
    this.headings = [];        // Store collected heading data
    this.tocElement = null;    // TOC container reference
    this.triggerElement = null; // Trigger button reference
  }

  /**
   * Collect all headings from the page matching specified levels
   * Automatically generates IDs for headings without them
   */
  collectHeadings() {
    const selector = this.headingLevels.join(', ');
    const elements = document.querySelectorAll(selector);
    
    this.headings = Array.from(elements).map((heading, index) => {
      // Generate ID if heading doesn't have one
      if (!heading.id) {
        heading.id = `heading-${index}`;
      }

      return {
        id: heading.id,
        text: heading.textContent.trim(),
        level: parseInt(heading.tagName[1])  // Extract level from tag (h1=1, h2=2, etc.)
      };
    });
  }

  /**
   * Build nested TOC HTML structure with hover functionality for h2/h3
   * Hides h2/h3 by default, reveals on h1/h2 hover with delay
   */
  buildTocStructure() {
    const container = document.createElement('div');
    container.id = this.tocId;
    container.className = 'toc-wrapper hover-toc';

    // TOC title
    const header = document.createElement('h3');
    header.className = 'toc-title';
    header.textContent = 'Table of Contents';
    container.appendChild(header);

    let currentList = null;
    let lastLevel = null;
    const listStack = [];  // Stack for nested list management

    this.headings.forEach((heading, index) => {
      const level = heading.level;
      const listItem = document.createElement('li');
      const link = document.createElement('a');

      link.href = `#${heading.id}`;
      link.textContent = heading.text;
      link.className = `toc-link toc-level-${level}`;

      // Smooth scroll on click
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.smoothScrollToHeading(heading.id);
      });

      listItem.appendChild(link);
      listItem.className = `toc-item toc-level-${level}`;

      // Hide h2 and h3 items by default
      if (level === 2 || level === 3) {
        listItem.classList.add('toc-hidden');
      }

      // Add data attribute for easy selection in hover logic
      listItem.setAttribute('data-toc-id', heading.id);

      /**
       * H1 HOVER LOGIC: Show/hide child h2 (and their h3 children)
       * Collects all h2 until next h1
       */
      if (level === 1) {
        const nextItems = [];
        let tempIndex = index + 1;

        // Gather all h2 headings until next h1
        while (tempIndex < this.headings.length && this.headings[tempIndex].level > 1) {
          if (this.headings[tempIndex].level === 2) {
            nextItems.push(`heading-${tempIndex}`);
          }
          tempIndex++;
        }

        // Show children on hover
        link.addEventListener('mouseenter', () => {
          nextItems.forEach(id => {
            const el = document.querySelector(`[data-toc-id="${id}"]`);
            if (el) el.classList.remove('toc-hidden');
          });
        });

        // Hide children on mouseleave with 200ms delay (allows moving to h2)
        link.addEventListener('mouseleave', () => {
          setTimeout(() => {
            if (!link.parentElement.matches(':hover')) {
              nextItems.forEach(id => {
                const el = document.querySelector(`[data-toc-id="${id}"]`);
                if (el) el.classList.add('toc-hidden');
              });
            }
          }, 500);
        });
      }

      /**
       * H2 HOVER LOGIC: Show/hide child h3 items
       * Collects all h3 until next h2 or h1
       */
      if (level === 2) {
        const nextItems = [];
        let tempIndex = index + 1;

        // Gather all h3 headings until next h2/h1
        while (tempIndex < this.headings.length && this.headings[tempIndex].level > 2) {
          if (this.headings[tempIndex].level === 3) {
            nextItems.push(`heading-${tempIndex}`);
          }
          tempIndex++;
        }

        // Show h3 children on h2 hover
        link.addEventListener('mouseenter', () => {
          nextItems.forEach(id => {
            const el = document.querySelector(`[data-toc-id="${id}"]`);
            if (el) el.classList.remove('toc-hidden');
          });
        });

        // Hide h3 on mouseleave with delay
        link.addEventListener('mouseleave', () => {
          setTimeout(() => {
            if (!link.parentElement.matches(':hover')) {
              nextItems.forEach(id => {
                const el = document.querySelector(`[data-toc-id="${id}"]`);
                if (el) el.classList.add('toc-hidden');
              });
            }
          }, 200);
        });
      }

      // NESTED LIST LOGIC: Create proper hierarchy (h1 > h2 > h3)
      if (lastLevel === null) {
        // First heading - create root list
        currentList = document.createElement('ul');
        currentList.className = 'toc-list';
        listStack.push(currentList);
        currentList.appendChild(listItem);
        lastLevel = level;
      } else if (level > lastLevel) {
        // Deeper level - create nested list
        for (let i = lastLevel; i < level; i++) {
          const newList = document.createElement('ul');
          newList.className = 'toc-list';
          if (currentList.lastElementChild) {
            currentList.lastElementChild.appendChild(newList);
          } else {
            currentList.appendChild(newList);
          }
          listStack.push(newList);
          currentList = newList;
        }
        currentList.appendChild(listItem);
        lastLevel = level;
      } else if (level < lastLevel) {
        // Go up levels
        for (let i = level; i < lastLevel; i++) {
          listStack.pop();
        }
        currentList = listStack[listStack.length - 1];
        currentList.appendChild(listItem);
        lastLevel = level;
      } else {
        // Same level - add to current list
        currentList.appendChild(listItem);
      }
    });

    // Add root list to container
    if (listStack.length > 0) {
      container.appendChild(listStack[0]);
    }

    return container;
  }

  /**
   * Smooth scroll to target heading with temporary highlight effect
   * @param {string} headingId - ID of target heading
   */
  smoothScrollToHeading(headingId) {
    const element = document.getElementById(headingId);
    if (element) {
      // Scroll with 80px offset for fixed headers
      const offsetTop = element.offsetTop - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
      
      // Highlight effect
      element.classList.add('highlight-heading');
      setTimeout(() => element.classList.remove('highlight-heading'), 2000);
    }
  }

  /**
   * Create or retrieve the trigger button element
   * Creates floating button if no existing trigger found
   */
  createTriggerElement() {
    // Try to find existing trigger element
    this.triggerElement = document.querySelector(this.triggerSelector);
    
    if (!this.triggerElement) {
      // Create new floating trigger button
      this.triggerElement = document.createElement('div');
      this.triggerElement.id = 'toc-trigger';
      this.triggerElement.innerHTML = 'Summary';
      this.triggerElement.className = 'toc-trigger';
      this.triggerElement.title = 'Show Table of Contents';
      document.body.appendChild(this.triggerElement);
    }
  }

  /**
   * Inject all required CSS styles for hover TOC functionality
   * Includes animations, hover effects, responsive design
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* TOC Trigger Button - Fixed floating button */
      .toc-trigger {
        position: fixed;
        top: 20px;
        left: 20px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #5EB052, #4A9F4A);
        border: none;
        border-radius: 50%;
        color: white;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(94, 176, 82, 0.4);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(10px);
      }

      .toc-trigger:hover {
        transform: scale(1.1) rotate(10deg);
        box-shadow: 0 8px 25px rgba(94, 176, 82, 0.6);
        background: linear-gradient(135deg, #6EC35C, #5EB052);
      }

      /* Hover TOC Container - Shows on trigger hover */
      .hover-toc {
        position: fixed;
        top: 80px;
        left: 20px;
        width: 320px;
        max-height: 70vh;
        overflow-y: auto;
        opacity: 0;
        visibility: hidden;
        transform: translateX(-100%);
        transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        z-index: 9999;
        scroll-behavior: smooth;
      }

      .toc-trigger:hover + .hover-toc,
      .hover-toc:hover {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
      }

      /* TOC Content Styling */
      .toc-wrapper {
        background: linear-gradient(135deg, rgba(255, 253, 208, 0.95) 0%, rgba(200, 220, 200, 0.95) 100%);
        backdrop-filter: blur(20px);
        border: 2px solid rgba(94, 176, 82, 0.3);
        border-radius: 15px;
        padding: 25px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      }

      .toc-title {
        font-size: 16px;
        font-weight: 600;
        color: #2D5A27;
        margin: 0 0 20px 0;
        padding-bottom: 12px;
        border-bottom: 2px solid rgba(94, 176, 82, 0.4);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .toc-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .toc-list ul {
        list-style: none;
        padding-left: 20px;
        margin: 8px 0;
        border-left: 2px solid rgba(94, 176, 82, 0.3);
      }

      .toc-item {
        margin: 6px 0;
      }

      /* Hide h2/h3 items by default */
      .toc-hidden {
        display: none;
      }

      /* Show animation for revealed items */
      .toc-item:not(.toc-hidden) {
        display: list-item;
        animation: slideDown 1.5s ease;
        margin: 6px 0;
      }

      /* Slide down appearance animation */
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Extra indentation for h3 level */
      .toc-item.toc-level-3:not(.toc-hidden) {
        margin-left: 12px;
      }

      .toc-link {
        color: #2D5A27;
        text-decoration: none;
        font-size: 14px;
        padding: 8px 12px;
        border-radius: 8px;
        transition: all 0.3s ease;
        display: block;
        line-height: 1.4;
      }

      .toc-link:hover {
        background: rgba(94, 176, 82, 0.2);
        color: #1A3D14;
        transform: translateX(4px);
      }

      /* Level-specific styling */
      .toc-link.toc-level-1 { font-weight: 600; font-size: 15px; }
      .toc-link.toc-level-2 { color: #3A7A3A; padding-left: 8px; }
      .toc-link.toc-level-3 { color: #4A9F4A; font-size: 13px; }
      .toc-link.toc-level-4 { color: #5EB052; font-size: 12px; padding-left: 16px; }

      /* Target heading highlight effect */
      .highlight-heading {
        animation: highlight-pulse 2s ease-out;
        background: linear-gradient(90deg, rgba(94, 176, 82, 0.2), rgba(94, 176, 82, 0.1));
        border-left: 4px solid #5EB052;
        padding-left: 10px !important;
      }

      @keyframes highlight-pulse {
        0% { background: rgba(94, 176, 82, 0.4); }
        100% { background: transparent; }
      }

      /* Mobile responsive adjustments */
      @media (max-width: 768px) {
        .toc-trigger {
          top: 15px;
          left: 15px;
          width: 45px;
          height: 45px;
          font-size: 18px;
        }

        .hover-toc {
          left: 15px;
          top: 70px;
          width: 280px;
        }

        .toc-wrapper {
          padding: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize the entire hover TOC system
   * Collects headings, creates elements, injects styles
   */
  init() {
    this.injectStyles();
    this.collectHeadings();
    
    if (this.headings.length === 0) {
      console.warn('No headings found matching specified levels');
      return;
    }

    this.createTriggerElement();
    this.tocElement = this.buildTocStructure();

    // Position TOC after trigger element
    this.triggerElement.insertAdjacentElement('afterend', this.tocElement);
  }
}

// Auto-initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const toc = new HoverTableOfContents();
  toc.init();

  // Make TOC refreshable for dynamic content
  window.refreshHoverTOC = () => {
    toc.collectHeadings();
    const newToc = toc.buildTocStructure();
    if (toc.tocElement) toc.tocElement.replaceWith(newToc);
    toc.tocElement = newToc;
  };
});
