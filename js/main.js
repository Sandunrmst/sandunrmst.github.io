/*
* Author: RMST
* Version: 2.0
*/



(function ($) {
    "use strict";
    // Subpages resize
    function subpages_resize() {
        var subpagesHeight = $('.pt-page-current').height();
        $(".subpages").height(subpagesHeight + 50);
    }

    // Portfolio subpage filters
    function portfolio_init() {
        var portfolio_grid = $('#portfolio_grid'),
            portfolio_filter = $('#portfolio_filters');

        if (portfolio_grid) {

            portfolio_grid.shuffle({
                speed: 450,
                itemSelector: 'figure'
            });

            $('.site-main-menu').on("click", "a", function (e) {
                portfolio_grid.shuffle('update');
            });


            portfolio_filter.on("click", ".filter", function (e) {
                portfolio_grid.shuffle('update');
                e.preventDefault();
                $('#portfolio_filters .filter').parent().removeClass('active');
                $(this).parent().addClass('active');
                portfolio_grid.shuffle('shuffle', $(this).attr('data-group'));
                setTimeout(function () {
                    subpages_resize();
                }, 500);
            });

        }
    }
    // /Portfolio subpage filters

    // Hide Mobile menu
    function mobileMenuHide() {
        var windowWidth = $(window).width();
        if (windowWidth < 1024) {
            $('#site_header').addClass('mobile-menu-hide');
            $('#rmst_rotator').removeClass('rotator-hide');
        }
    }
    // /Hide Mobile menu

    //On Window load & Resize
    $(window)
        .on('load', function () { //Load
            // Animation on Page Loading
            $(".preloader").fadeOut("slow");

            // initializing page transition.
            var ptPage = $('.subpages');
            if (ptPage[0]) {
                PageTransitions.init({
                    menu: 'ul.site-main-menu',
                });
            }
        })
        .on('resize', function () { //Resize
            mobileMenuHide();

            setTimeout(function () {
                subpages_resize();
            }, 500);
        })
        .scroll(function () {
            if ($(window).scrollTop() < 20) {
                $('.header').removeClass('sticked');
            } else {
                $('.header').addClass('sticked');
            }
        })
        .scrollTop(0);


    // On Document Load
    $(document).on('ready', function () {

        // Initialize Portfolio grid
        var $portfolio_container = $("#portfolio-grid");

        $portfolio_container.imagesLoaded(function () {
            setTimeout(function () {
                portfolio_init(this);
            }, 500);
        });

        // Portfolio hover effect init
        $(' #portfolio_grid > figure ').each(function () { $(this).hoverdir(); });

        // Lightbox init
        $('body').magnificPopup({
            delegate: 'a.lightbox',
            type: 'image',
            removalDelay: 300,

            // Class that is added to popup wrapper and background
            // make it unique to apply your CSS animations just to this exact popup
            mainClass: 'mfp-fade',
            image: {
                // options for image content type
                titleSrc: 'title',
                gallery: {
                    enabled: true
                },
            },

            iframe: {
                markup: '<div class="mfp-iframe-scaler">' +
                    '<div class="mfp-close"></div>' +
                    '<iframe class="mfp-iframe" frameborder="0" allowfullscreen></iframe>' +
                    '<div class="mfp-title mfp-bottom-iframe-title"></div>' +
                    '</div>', // HTML markup of popup, `mfp-close` will be replaced by the close button

                patterns: {
                    youtube: {
                        index: 'youtube.com/', // String that detects type of video (in this case YouTube). Simply via url.indexOf(index).

                        id: null, // String that splits URL in a two parts, second part should be %id%
                        // Or null - full URL will be returned
                        // Or a function that should return %id%, for example:
                        // id: function(url) { return 'parsed id'; }

                        src: '%id%?autoplay=1' // URL that will be set as a source for iframe.
                    },
                    vimeo: {
                        index: 'vimeo.com/',
                        id: '/',
                        src: '//player.vimeo.com/video/%id%?autoplay=1'
                    },
                    gmaps: {
                        index: '//maps.google.',
                        src: '%id%&output=embed'
                    }
                },

                srcAction: 'iframe_src', // Templating object key. First part defines CSS selector, second attribute. "iframe_src" means: find "iframe" and set attribute "src".
            },

            callbacks: {
                markupParse: function (template, values, item) {
                    values.title = item.el.attr('title');
                }
            },
        });

        $('.ajax-page-load-link').magnificPopup({
            type: 'ajax',
            removalDelay: 300,
            mainClass: 'mfp-fade',
            gallery: {
                enabled: true
            },
        });


        //Testimonial Section
        const swiper = new Swiper('.swiper', {
            autoHeight: true,
            loop: true,
            autoplay: {
                delay: 5000,
                disableOnInteraction: false,
            },

            // If we need pagination
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },

            // Navigation arrows
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },

        });

        //Testimonial Section End

        // Mobile menu
        $('.menu-toggle').on("click", function () {
            $('#site_header').toggleClass('mobile-menu-hide');
            $('#rmst_rotator').toggleClass('rotator-hide');
        });

        // Mobile menu hide on main menu item click
        $('.site-main-menu').on("click", "a", function (e) {
            mobileMenuHide();
        });

        // Sidebar toggle
        $('.sidebar-toggle').on("click", function () {
            $('#blog-sidebar').toggleClass('open');
        });


    });

})(jQuery);

/*Quick Roteter */

const navrmst = document.querySelector(".nav-rmst"),
    toggleBtnRmst = navrmst.querySelector(".toggle-btn-rmst");

iconBtnRmst = navrmst.querySelectorAll(".iconclose")
// console.log(iconBtn)
iconBtnRmst.forEach(btn => {
    btn.addEventListener("click", () => {
        navrmst.classList.remove("open");
    });
});


toggleBtnRmst.addEventListener("click", () => {
    navrmst.classList.toggle("open");
});



/* Infinite Slider  */


const scrollers = document.querySelectorAll(".scroller");

// If a user hasn't opted in for recuded motion, then we add the animation
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    addAnimation();
}

function addAnimation() {
    scrollers.forEach((scroller) => {
        // add data-animated="true" to every `.scroller` on the page
        scroller.setAttribute("data-animated", true);

        // Make an array from the elements within `.scroller-inner`
        const scrollerInner = scroller.querySelector(".scroller__inner");
        const scrollerContent = Array.from(scrollerInner.children);

        // For each item in the array, clone it
        // add aria-hidden to it
        // add it into the `.scroller-inner`
        scrollerContent.forEach((item) => {
            const duplicatedItem = item.cloneNode(true);
            duplicatedItem.setAttribute("aria-hidden", true);
            scrollerInner.appendChild(duplicatedItem);
        });
    });
}

/* Premium Tools Modal Logic */
document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById("tools-modal");

    // Event delegation for opening modal
    document.addEventListener('click', function (e) {
        // Check if the clicked element is the button or inside it
        var targetBtn = e.target.closest('#open-tools-modal');
        if (targetBtn) {
            e.preventDefault();
            if (modal) modal.style.display = "block";
        }

        // Closing modal
        if (e.target.classList.contains('close-modal') || e.target == modal) {
            if (modal) modal.style.display = "none";
        }
    });
});
