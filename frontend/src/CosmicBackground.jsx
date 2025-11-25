import { useEffect, useRef } from 'react';
import './cosmic-background.css';

export default function CosmicBackground() {
    const starFieldRef = useRef(null);

    useEffect(() => {
        // Generate high-density star field for 4K quality
        function createStarField() {
            const starField = starFieldRef.current;
            if (!starField) return;
            
            // Clear existing stars
            starField.innerHTML = '';
            
            // Adaptive density based on screen size - more stars for better visibility
            const starCount = Math.floor(window.innerWidth * window.innerHeight / 5000);
            
            // Use DocumentFragment for batch DOM operations (much faster)
            const fragment = document.createDocumentFragment();
            
            for (let i = 0; i < starCount; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                
                // Random size distribution - more realistic (mostly small stars)
                const sizeRand = Math.random();
                if (sizeRand < 0.85) {
                    star.classList.add('small');
                } else if (sizeRand < 0.97) {
                    star.classList.add('medium');
                } else {
                    star.classList.add('large');
                }
                
                // Random position
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                
                // Random animation delay for natural twinkling
                star.style.animationDelay = Math.random() * 3 + 's';
                star.style.animationDuration = (2 + Math.random() * 4) + 's';
                
                fragment.appendChild(star);
            }
            
            // Single DOM update instead of multiple
            starField.appendChild(fragment);
        }

        // Initialize on mount
        createStarField();
        
        // Regenerate on resize for optimal quality
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                createStarField();
            }, 250);
        };

        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="cosmic-container">
            <div className="star-field" ref={starFieldRef}></div>
            <div className="nebula"></div>
            <div className="nebula-layer-2"></div>
            <div className="nebula-depth"></div>
            <div className="nebula-accent"></div>
            <div className="nebula-core"></div>
            <div className="nebula-arm"></div>
        </div>
    );
}

