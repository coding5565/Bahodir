document.addEventListener('DOMContentLoaded', function () {
    // Initialize all features
    initTypingEffect();
    initCustomCursor();
});

function initCustomCursor() {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    
    // Check if cursor elements exist (they might be hidden on mobile via CSS, but JS should still find them)
    if (!cursorDot || !cursorOutline) return;

    window.addEventListener('mousemove', (e) => {
        const posX = e.clientX;
        const posY = e.clientY;

        // Use requestAnimationFrame for smoother performance
        requestAnimationFrame(() => {
            cursorDot.style.left = `${posX}px`;
            cursorDot.style.top = `${posY}px`;

            // Delayed effect for the outline for professional feel
            cursorOutline.animate({
                left: `${posX}px`,
                top: `${posY}px`
            }, { duration: 500, fill: "forwards" });
        });
    });

    // Cursor scaling effects on interactive elements
    const interactables = document.querySelectorAll('a, button, .social-link, .sun-core');
    interactables.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorOutline.classList.add('cursor-active');
            cursorDot.style.transform = 'translate(-50%, -50%) scale(0.5)';
        });
        el.addEventListener('mouseleave', () => {
            cursorOutline.classList.remove('cursor-active');
            cursorDot.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    });
}

function initTypingEffect() {
    const typingText = document.getElementById('typing-text');
    if (!typingText) return;

    const phrases = [
        'Graphic Designer',
        'Logo Specialist',
        'Brand Identity',
        'Creative Thinker',
        'Visual Explorer'
    ];

    let currentPhraseIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    function typeEffect() {
        const currentPhrase = phrases[currentPhraseIndex];

        if (isDeleting) {
            typingText.textContent = currentPhrase.substring(0, currentCharIndex - 1);
            currentCharIndex--;
            typingSpeed = 50;
        } else {
            typingText.textContent = currentPhrase.substring(0, currentCharIndex + 1);
            currentCharIndex++;
            typingSpeed = 100;
        }

        if (!isDeleting && currentCharIndex === currentPhrase.length) {
            isDeleting = true;
            typingSpeed = 2000;
        } else if (isDeleting && currentCharIndex === 0) {
            isDeleting = false;
            currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
            typingSpeed = 500;
        }

        setTimeout(typeEffect, typingSpeed);
    }

    typeEffect();
}
