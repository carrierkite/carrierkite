
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api'; // ✅
  
    const isTouchDevice = () => {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
};

    // function switchTab(tab) {
    //   const tabs = document.querySelectorAll('.tab');
    //   const forms = document.querySelectorAll('.form-container');

    //   tabs.forEach(t => t.classList.remove('active'));
    //   forms.forEach(f => f.classList.remove('active'));

    //   this.target.classList.add('active');
    //   document.getElementById(`${tab}-form`).classList.add('active');

    //   hideAlert();
    // }
  function switchTab(event, tab) { // Added event here
    const tabs = document.querySelectorAll('.tab');
    const forms = document.querySelectorAll('.form-container');

    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    // Use event.currentTarget instead of this.target
    if (event) event.currentTarget.classList.add('active');
    
    document.getElementById(`${tab}-form`).classList.add('active');
    hideAlert();
}


    function showAlert(message, type) {
      const alert = document.getElementById('alert');
      alert.textContent = message;
      alert.className = `alert ${type} show`;
    }

    function hideAlert() {
      const alert = document.getElementById('alert');
      alert.classList.remove('show');
    }

    function showLoading() {
      document.getElementById('loading').classList.add('show');
      document.getElementById('login-btn').disabled = true;
      document.getElementById('signup-btn').disabled = true;
    }

    function hideLoading() {
      document.getElementById('loading').classList.remove('show');
      document.getElementById('login-btn').disabled = false;
      document.getElementById('signup-btn').disabled = false;
    }

    async function handleLogin(event) {
      event.preventDefault();
      hideAlert();

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      showLoading();

      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem('session', JSON.stringify(data.session));
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('broker', JSON.stringify(data.broker));

        showAlert('Login successful! Redirecting...', 'success');

        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1000);

      } catch (error) {
        console.error('Login error:', error);
        showAlert(error.message || 'Login failed. Please try again.', 'error');
      } finally {
        hideLoading();
      }
    }

    async function handleSignup(event) {
      event.preventDefault();
      hideAlert();

      const companyName = document.getElementById('signup-company').value;
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      const confirmPassword = document.getElementById('signup-confirm-password').value;

      if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
      }

      showLoading();

      try {
        const response = await fetch(`${API_URL}/auth/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password,
            companyName
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Signup failed');
        }

        localStorage.setItem('session', JSON.stringify(data.session));
        localStorage.setItem('user', JSON.stringify(data.user));

        showAlert('Account created successfully! Redirecting to login...', 'success');

        setTimeout(() => {
          switchTab('login');
          document.getElementById('login-email').value = email;
          hideAlert();
        }, 2000);

      } catch (error) {
        console.error('Signup error:', error);
        showAlert(error.message || 'Signup failed. Please try again.', 'error');
      } finally {
        hideLoading();
      }
    }

    if (localStorage.getItem('session')) {
      window.location.href = '/dashboard.html';
    }





    document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

if (navToggle && navMenu) {
    function closeMenu() {
        navMenu.classList.remove('active');
        navToggle.querySelectorAll('span').forEach((span, i) => {
            span.style.transform = 'none';
            span.style.opacity = '1';
        });
    }

    navToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = navMenu.classList.toggle('active');
        const spans = navToggle.querySelectorAll('span');
        if (isOpen) {
            spans[0].style.transform = 'rotate(45deg) translateY(8px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translateY(-8px)';
        } else {
            closeMenu();
        }
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', function(e) {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            closeMenu();
        }
    });
}


    const navbar = document.querySelector('.navbar');
    if (navbar) {
        let lastScroll = 0;
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;

            if (currentScroll > 100) {
                navbar.style.background = 'rgba(10, 10, 10, 0.98)';
                navbar.style.boxShadow = '0 4px 30px rgba(212, 175, 55, 0.2)';
            } else {
                navbar.style.background = 'rgba(10, 10, 10, 0.95)';
                navbar.style.boxShadow = '0 2px 20px rgba(212, 175, 55, 0.1)';
            }

            lastScroll = currentScroll;
        });
    }

    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        const icon = item.querySelector('.faq-icon');

        if (question && answer && icon) {
            question.addEventListener('click', function() {
                const isActive = answer.style.maxHeight && answer.style.maxHeight !== '0px';

                document.querySelectorAll('.faq-answer').forEach(ans => {
                    ans.style.maxHeight = '0';
                    ans.style.padding = '0 25px';
                });

                document.querySelectorAll('.faq-icon').forEach(ic => {
                    ic.style.transform = 'rotate(0deg)';
                    ic.textContent = '+';
                });

                if (!isActive) {
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                    answer.style.padding = '0 25px 25px';
                    icon.style.transform = 'rotate(45deg)';
                    icon.textContent = '×';
                }
            });
        }
    });

    const authTabs = document.querySelectorAll('.auth-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            authTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    const passwordInput = document.getElementById('signup-password');
    if (passwordInput) {
        const strengthBar = document.querySelector('.strength-fill');
        const strengthText = document.querySelector('.strength-text');

        passwordInput.addEventListener('input', function() {
            const value = this.value;
            let strength = 0;

            if (value.length >= 8) strength += 25;
            if (value.match(/[a-z]+/)) strength += 25;
            if (value.match(/[A-Z]+/)) strength += 25;
            if (value.match(/[0-9]+/)) strength += 25;

            if (strengthBar) {
                strengthBar.style.width = strength + '%';
            }

            if (strengthText) {
                if (strength <= 25) {
                    strengthText.textContent = 'Weak password';
                    strengthText.style.color = '#ef4444';
                } else if (strength <= 50) {
                    strengthText.textContent = 'Fair password';
                    strengthText.style.color = '#f59e0b';
                } else if (strength <= 75) {
                    strengthText.textContent = 'Good password';
                    strengthText.style.color = '#10b981';
                } else {
                    strengthText.textContent = 'Strong password';
                    strengthText.style.color = '#10b981';
                }
            }
        });
    }

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.feature-card, .pricing-card, .value-item');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.style.animation = 'fadeInUp 0.6s ease forwards';
    });

    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('focus', function() {
            this.parentElement.querySelector('svg').style.color = '#d4af37';
        });

        searchInput.addEventListener('blur', function() {
            this.parentElement.querySelector('svg').style.color = '#666';
        });
    }

    const formInputs = document.querySelectorAll('.form-input');
    formInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
        });

        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });
    });

    const buttons = document.querySelectorAll('.btn, .quick-btn, .action-btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function(e) {
            const ripple = document.createElement('span');
            ripple.style.position = 'absolute';
            ripple.style.width = '5px';
            ripple.style.height = '5px';
            ripple.style.background = 'rgba(255, 255, 255, 0.5)';
            ripple.style.borderRadius = '50%';
            ripple.style.transform = 'translate(-50%, -50%)';
            ripple.style.animation = 'ripple 0.6s ease-out';

            const rect = button.getBoundingClientRect();
            ripple.style.left = (e.clientX - rect.left) + 'px';
            ripple.style.top = (e.clientY - rect.top) + 'px';

            if (button.style.position !== 'absolute' && button.style.position !== 'relative') {
                button.style.position = 'relative';
            }

            button.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    const statsNumbers = document.querySelectorAll('.stat-number');
    statsNumbers.forEach(stat => {
        const value = stat.textContent;
        if (!isNaN(parseInt(value))) {
            const finalValue = parseInt(value);
            let currentValue = 0;
            const increment = finalValue / 50;
            const duration = 2000;
            const stepTime = duration / 50;

            const counter = setInterval(() => {
                currentValue += increment;
                if (currentValue >= finalValue) {
                    stat.textContent = value;
                    clearInterval(counter);
                } else {
                    stat.textContent = Math.floor(currentValue);
                }
            }, stepTime);
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || !href) return;

            e.preventDefault();
            const target = document.querySelector(href);

            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    if (!isTouchDevice()) {
        const cursor = document.createElement('div');
        cursor.classList.add('custom-cursor');
        cursor.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            border: 2px solid #d4af37;
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            transition: transform 0.2s ease, opacity 0.2s ease;
            opacity: 0;
            transform: translate(-50%, -50%); /* Centers the circle on the tip of the mouse */
        `;
        document.body.appendChild(cursor);

        let mouseX = 0; let mouseY = 0;
        let cursorX = 0; let cursorY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            cursor.style.opacity = '1';
        });

        document.addEventListener('mouseleave', () => {
            cursor.style.opacity = '0';
        });

        function animateCursor() {
            const dx = mouseX - cursorX;
            const dy = mouseY - cursorY;
            cursorX += dx * 0.2;
            cursorY += dy * 0.2;
            cursor.style.left = cursorX + 'px';
            cursor.style.top = cursorY + 'px';
            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Hover effects for all interactive elements
        const interactiveElements = document.querySelectorAll('a, button, .nav-item, .feature-card, .pricing-card, input, textarea, select, .auth-tab, .faq-question');
        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
                cursor.style.borderColor = '#f0d677';
            });
            el.addEventListener('mouseleave', () => {
                cursor.style.transform = 'translate(-50%, -50%) scale(1)';
                cursor.style.borderColor = '#d4af37';
            });
        });
    }
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        });
    }
});