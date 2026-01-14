// Dynamic Table of Contents Generator - HOVER ONLY

class HoverTableOfContents {
  /**
   * Constructor - Initialize the hover TOC generator
   * @param {string} triggerSelector - CSS selector for the hover trigger area
   * @param {array} headingLevels - Array of heading levels to include (h1, h2, etc.)
   * @param {string} tocId - ID for the TOC container element
   */
  constructor(
    triggerSelector = "#toc-trigger",
    headingLevels = ["h1", "h2", "h3", "h4"],
    tocId = "toc-container"
  ) {
    this.triggerSelector = triggerSelector;
    this.headingLevels = headingLevels;
    this.tocId = tocId;
    this.headings = []; // Store collected heading data
    this.tocElement = null; // TOC container reference
    this.triggerElement = null; // Trigger button reference
  }

  /**
   * Collect all headings from the page matching specified levels
   * Automatically generates IDs for headings without them
   */
  collectHeadings() {
  const selector = this.headingLevels.join(", ");
  const elements = document.querySelectorAll(selector);

  this.headings = Array.from(elements)
    .filter((heading) => !heading.closest("header"))
    .map((heading, index) => {
      if (!heading.id) {
        heading.id = `heading-${index}`;
      }

      return {
        id: heading.id,
        text: heading.textContent.trim(),
        level: parseInt(heading.tagName[1]),
      };
    });
}


  /**
   * Build nested TOC HTML structure with hover functionality for h2/h3
   * Hides h2/h3 by default, reveals on h1/h2 hover with delay
   */
  buildTocStructure() {
    const container = document.createElement("div");
    container.id = this.tocId;
    container.className = "toc-wrapper hover-toc";

    // TOC title
    const header = document.createElement("h3");
    header.className = "toc-title";
    header.textContent = "Table of Contents";
    container.appendChild(header);

    let currentList = null;
    let lastLevel = null;
    const listStack = []; // Stack for nested list management

    this.headings.forEach((heading, index) => {
      const level = heading.level;
      const listItem = document.createElement("li");
      const link = document.createElement("a");

      link.href = `#${heading.id}`;
      link.textContent = heading.text;
      link.className = `toc-link toc-level-${level}`;

      // Smooth scroll on click
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.smoothScrollToHeading(heading.id);
      });

      listItem.appendChild(link);
      listItem.className = `toc-item toc-level-${level}`;

      // Hide h2 and h3 items by default
      if (level === 2 || level === 3) {
        listItem.classList.add("toc-hidden");
      }

      // Add data attribute for easy selection in hover logic
      listItem.setAttribute("data-toc-id", heading.id);

      /**
       * H1 HOVER LOGIC: Show/hide child h2 (and their h3 children)
       * Collects all h2 until next h1
       */
      if (level === 1) {
        const nextItems = [];
        let tempIndex = index + 1;

        // Gather all h2 headings until next h1
        while (
          tempIndex < this.headings.length &&
          this.headings[tempIndex].level > 1
        ) {
          if (this.headings[tempIndex].level === 2) {
            nextItems.push(`heading-${tempIndex}`);
          }
          tempIndex++;
        }

        // Show children on hover with 800ms delay
        let h1HoverTimeout;
        link.addEventListener("mouseenter", () => {
          h1HoverTimeout = setTimeout(() => {
            nextItems.forEach((id) => {
              const el = document.querySelector(`[data-toc-id="${id}"]`);
              if (el) el.classList.remove("toc-hidden");
            });
          }, 800);
        });

        // Hide children on mouseleave with 700ms delay (allows moving to h2)
        link.addEventListener("mouseleave", () => {
          clearTimeout(h1HoverTimeout);
          setTimeout(() => {
            if (!link.parentElement.matches(":hover")) {
              nextItems.forEach((id) => {
                const el = document.querySelector(`[data-toc-id="${id}"]`);
                if (el) el.classList.add("toc-hidden");
              });
            }
          }, 700);
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
        while (
          tempIndex < this.headings.length &&
          this.headings[tempIndex].level > 2
        ) {
          if (this.headings[tempIndex].level === 3) {
            nextItems.push(`heading-${tempIndex}`);
          }
          tempIndex++;
        }

        // Show h3 children on h2 hover with 600ms delay
        let h2HoverTimeout;
        link.addEventListener("mouseenter", () => {
          h2HoverTimeout = setTimeout(() => {
            nextItems.forEach((id) => {
              const el = document.querySelector(`[data-toc-id="${id}"]`);
              if (el) el.classList.remove("toc-hidden");
            });
          }, 600);
        });

        // Hide h3 on mouseleave with delay
        link.addEventListener("mouseleave", () => {
          clearTimeout(h2HoverTimeout);
          setTimeout(() => {
            if (!link.parentElement.matches(":hover")) {
              nextItems.forEach((id) => {
                const el = document.querySelector(`[data-toc-id="${id}"]`);
                if (el) el.classList.add("toc-hidden");
              });
            }
          }, 500);
        });
      }

      // NESTED LIST LOGIC: Create proper hierarchy (h1 > h2 > h3)
      if (lastLevel === null) {
        // First heading - create root list
        currentList = document.createElement("ul");
        currentList.className = "toc-list";
        listStack.push(currentList);
        currentList.appendChild(listItem);
        lastLevel = level;
      } else if (level > lastLevel) {
        // Deeper level - create nested list
        for (let i = lastLevel; i < level; i++) {
          const newList = document.createElement("ul");
          newList.className = "toc-list";
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
        behavior: "smooth",
      });

      // Highlight effect
      element.classList.add("highlight-heading");
      setTimeout(() => element.classList.remove("highlight-heading"), 2000);
    }
  }

  /**
   * Reset all submenus to hidden state (h2 and h3)
   */
  resetSubmenus() {
    const allSubItems = document.querySelectorAll('.toc-level-2, .toc-level-3');
    allSubItems.forEach(item => {
      item.classList.add('toc-hidden');
    });
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
      this.triggerElement = document.createElement("div");
      this.triggerElement.id = "toc-trigger";
      this.triggerElement.innerHTML = "Summary";
      this.triggerElement.className = "toc-trigger";
      this.triggerElement.title = "Show Table of Contents";
      document.body.appendChild(this.triggerElement);
    }
  }

  /**
   * Initialize the entire hover TOC system
   * Collects headings, creates elements
   */
  init() {
    this.collectHeadings();
    if (this.headings.length === 0) {
      console.warn("No headings found matching specified levels");
      return;
    }

    this.createTriggerElement();
    this.tocElement = this.buildTocStructure();

    // Position TOC after trigger element
    this.triggerElement.insertAdjacentElement("afterend", this.tocElement);

    // Reset submenus when TOC is hidden (when mouse leaves both trigger and TOC)
    let resetTimeout;
    const handleMouseLeave = () => {
      resetTimeout = setTimeout(() => {
        // Check if mouse is not over trigger or TOC
        if (!this.triggerElement.matches(':hover') && !this.tocElement.matches(':hover')) {
          this.resetSubmenus();
        }
      }, 1000);
    };

    const handleMouseEnter = () => {
      clearTimeout(resetTimeout);
    };

    this.triggerElement.addEventListener('mouseleave', handleMouseLeave);
    this.tocElement.addEventListener('mouseleave', handleMouseLeave);
    this.triggerElement.addEventListener('mouseenter', handleMouseEnter);
    this.tocElement.addEventListener('mouseenter', handleMouseEnter);
  }
}

// Auto-initialize when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
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
