/*
* Author: RMST
* Version: 2.0
*/



(function($) {
"use strict";
    // Subpages resize
    function subpages_resize() {
        var subpagesHeight = $('.pt-page-current').height();
        $(".subpages").height(subpagesHeight + 50);
    }
    

    // Hide Mobile menu
    function mobileMenuHide() {
        var windowWidth = $(window).width();
        if (windowWidth < 1024) {
            $('#site_header').addClass('mobile-menu-hide');
        }
    }
    // /Hide Mobile menu

    //On Window load & Resize
    $(window)
        .on('load', function() { //Load
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
        .on('resize', function() { //Resize
             mobileMenuHide();

             setTimeout(function(){
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
    $(document).on('ready', function() {
        
        //Testimonial Section
        const swiper = new Swiper('.swiper', {
            autoHeight: true,
            loop: true,
        
            // If we need pagination
            pagination: {
                el: '.swiper-pagination',
            },
        
            // Navigation arrows
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
        
        });

        //Testimonial Section

        // Mobile menu
        $('.menu-toggle').on("click", function () {
            $('#site_header').toggleClass('mobile-menu-hide');
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
