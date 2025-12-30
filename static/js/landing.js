// Landing Page JavaScript with GSAP Animations
document.addEventListener('DOMContentLoaded', function() {
    // Register GSAP plugins
    if (typeof gsap !== 'undefined') {
        if (typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);
        }
    }

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

    function toggleMobileMenu() {
        mobileMenuBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
        mobileMenuOverlay.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    }

    function closeMobileMenu() {
        mobileMenuBtn.classList.remove('active');
        navLinks.classList.remove('active');
        mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }

    // Close menu when clicking on nav links
    if (navLinks) {
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            });
        });
    }

    // Smooth scrolling for anchor links with GSAP
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                if (typeof gsap !== 'undefined' && gsap.registerPlugin) {
                    try {
                        gsap.to(window, {
                            duration: 1,
                            scrollTo: { y: target, offsetY: 80 },
                            ease: "power2.inOut"
                        });
                    } catch (err) {
                        // Fallback to native smooth scroll
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                } else {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // Navbar scroll effect with GSAP
    const navbar = document.querySelector('.navbar');
    if (navbar && typeof gsap !== 'undefined') {
        gsap.to(navbar, {
            scrollTrigger: {
                trigger: "body",
                start: "top -50",
                toggleClass: { className: "scrolled", targets: navbar }
            }
        });
    } else if (navbar) {
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            if (currentScroll > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // GSAP Animations for Hero Section
    if (typeof gsap !== 'undefined') {
        const heroText = document.querySelector('.hero-text');
        const heroVisual = document.querySelector('.hero-visual');
        
        if (heroText) {
            gsap.from(heroText, {
                opacity: 0,
                y: 50,
                duration: 1,
                ease: "power3.out"
            });
        }
        
        if (heroVisual) {
            gsap.from(heroVisual, {
                opacity: 0,
                x: 50,
                duration: 1,
                delay: 0.3,
                ease: "power3.out"
            });
        }

        // Hero parallax effect with GSAP
        const hero = document.querySelector('.hero');
        if (hero) {
            gsap.to(hero.querySelector('.hero-content'), {
                y: (i, el) => {
                    return ScrollTrigger.maxScroll(window) * 0.3;
                },
                ease: "none",
                scrollTrigger: {
                    trigger: hero,
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
        }
    }

    // GSAP ScrollTrigger animations for feature cards
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach((card, index) => {
            gsap.from(card, {
                scrollTrigger: {
                    trigger: card,
                    start: "top 85%",
                    toggleActions: "play none none none"
                },
                opacity: 0,
                y: 60,
                duration: 0.8,
                delay: index * 0.1,
                ease: "power3.out"
            });

            // Hover animation
            card.addEventListener('mouseenter', () => {
                gsap.to(card, {
                    y: -8,
                    duration: 0.3,
                    ease: "power2.out"
                });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, {
                    y: 0,
                    duration: 0.3,
                    ease: "power2.out"
                });
            });
        });
    }

    // GSAP ScrollTrigger animations for step items
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        const stepItems = document.querySelectorAll('.step-item');
        stepItems.forEach((step, index) => {
            gsap.from(step, {
                scrollTrigger: {
                    trigger: step,
                    start: "top 85%",
                    toggleActions: "play none none none"
                },
                opacity: 0,
                x: -80,
                duration: 0.8,
                delay: index * 0.15,
                ease: "power3.out"
            });
        });
    }

    // GSAP animations for stat numbers
    if (typeof gsap !== 'undefined') {
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(stat => {
            stat.addEventListener('mouseenter', function() {
                gsap.to(this, {
                    scale: 1.15,
                    duration: 0.3,
                    ease: "back.out(1.7)"
                });
            });
            stat.addEventListener('mouseleave', function() {
                gsap.to(this, {
                    scale: 1,
                    duration: 0.3,
                    ease: "power2.out"
                });
            });
        });
    }

    // GSAP animation for CTA section
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        const ctaSection = document.querySelector('.cta');
        if (ctaSection) {
            gsap.from(ctaSection.querySelectorAll('h2, p, .btn-primary'), {
                scrollTrigger: {
                    trigger: ctaSection,
                    start: "top 80%",
                    toggleActions: "play none none none"
                },
                opacity: 0,
                y: 40,
                duration: 0.8,
                stagger: 0.2,
                ease: "power3.out"
            });
        }
    }

    // Smooth scroll indicator animation
    if (typeof gsap !== 'undefined') {
        const scrollIndicator = document.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            gsap.to(scrollIndicator, {
                y: 10,
                duration: 1.5,
                repeat: -1,
                yoyo: true,
                ease: "power1.inOut"
            });
        }
    }
});

