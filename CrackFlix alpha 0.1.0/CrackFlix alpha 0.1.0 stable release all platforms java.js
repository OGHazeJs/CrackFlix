/* =========================================================================
   CRACKFLIX v2.4
   DYNAMIC HERO + VIDEO EPISODE PANEL
   Conservative rewrite
   ========================================================================= */

(() => {
    'use strict';


    /* =====================================================================
       SHARED HELPERS
       ===================================================================== */

    let updateTimer = null;

    function scheduleUpdate() {
        clearTimeout(updateTimer);

        updateTimer = setTimeout(() => {
            try {
                injectDynamicHeroBanner();
            } catch (error) {
                console.error('CrackFlix Hero Error:', error);
            }

            try {
                injectEpisodePopup();
            } catch (error) {
                console.error('CrackFlix Episode Popup Error:', error);
            }
        }, 100);
    }


    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = String(value);

        return div.innerHTML;
    }


    function getOverview(overview) {
        if (!overview) {
            return '';
        }

        const text = String(overview).trim();

        if (text.length <= 220) {
            return text;
        }

        return text.substring(0, 217).trimEnd() + '...';
    }


    /* =====================================================================
       DYNAMIC HERO BANNER
       ===================================================================== */

    function fetchRandomCrackFlixMedia(callback) {

        if (
            typeof ApiClient === 'undefined' ||
            typeof ApiClient.getItems !== 'function'
        ) {
            return;
        }

        const userId =
            typeof ApiClient.getCurrentUserId === 'function'
                ? ApiClient.getCurrentUserId()
                : null;

        if (!userId) {
            return;
        }

        ApiClient.getItems(userId, {
            IncludeItemTypes: 'Movie,Series',
            ImageTypes: 'Backdrop',
            Recursive: true,
            Fields: 'Overview',
            Limit: 50,
            SortBy: 'Random'
        })
        .then(result => {

            if (
                !result ||
                !Array.isArray(result.Items) ||
                !result.Items.length
            ) {
                return;
            }

            callback(result.Items[0]);
        })
        .catch(error => {
            console.error('CrackFlix API Error:', error);
        });
    }


    function injectDynamicHeroBanner() {

        const home = document.querySelector('#indexPage');

        if (!home) {
            return;
        }


        /*
         * -------------------------------------------------------------
         * VERWIJDER EVENTUELE HERO UIT FAVORITES
         * -------------------------------------------------------------
         *
         * Jellyfin gebruikt #indexPage ook voor Favorites.
         * Favorites heeft een itemscontainer met:
         *
         * data-monitor="markfavorite"
         *
         * Als daar een hero terecht is gekomen, verwijderen we
         * uitsluitend die foutieve hero.
         */

        const existingHero = home.querySelector('.cf-hero-banner');

        if (
            existingHero &&
            existingHero.parentElement?.querySelector(
                '.itemsContainer[data-monitor="markfavorite"]'
            )
        ) {
            existingHero.remove();
        }


        /*
         * -------------------------------------------------------------
         * VOORKOM DUBBELE HERO'S
         * -------------------------------------------------------------
         */

        if (home.querySelector('.cf-hero-banner')) {
            return;
        }


        /*
         * -------------------------------------------------------------
         * ZOEK DE JUISTE TARGET
         * -------------------------------------------------------------
         *
         * We gebruiken niet langer blind de eerste .scrollSlider.
         *
         * Favorites gebruikt namelijk ook .scrollSlider, maar met:
         *
         * data-monitor="markfavorite"
         *
         * Die wordt hier expliciet overgeslagen.
         */

        const target =
            Array.from(
                home.querySelectorAll('.scrollSlider')
            ).find(scrollSlider =>
                scrollSlider.getAttribute('data-monitor') !== 'markfavorite'
            ) ||
            home.querySelector('.section0');


        if (!target) {
            return;
        }


        fetchRandomCrackFlixMedia(item => {

            /*
             * Jellyfin kan ondertussen opnieuw gerenderd hebben.
             */

            if (
                !document.body.contains(home) ||
                home.querySelector('.cf-hero-banner')
            ) {
                return;
            }

            if (!item || !item.Id) {
                return;
            }

            if (
                typeof ApiClient === 'undefined' ||
                typeof ApiClient.getImageUrl !== 'function'
            ) {
                return;
            }


            /*
             * Extra beveiliging:
             * controleer nogmaals of de gekozen target inmiddels
             * een Favorites-container is geworden.
             */

            if (
                target.matches(
                    '.itemsContainer[data-monitor="markfavorite"]'
                )
            ) {
                return;
            }


            const backdropUrl = ApiClient.getImageUrl(item.Id, {
                type: 'Backdrop',
                quality: 90
            });

            const overview = getOverview(item.Overview);

            const tag =
                item.Type === 'Series'
                    ? 'A CRACKFLIX ORIGINAL SERIES'
                    : 'CRACKFLIX BLOCKBUSTER MOVIE';


            /* -------------------------------------------------------------
               HERO ELEMENT
               ------------------------------------------------------------- */

            const hero = document.createElement('section');

            hero.className = 'cf-hero-banner';

            hero.style.backgroundImage =
                `url("${backdropUrl}")`;


            hero.innerHTML = `
                <div class="cf-hero-overlay"></div>

                <div class="cf-hero-content">

                    <div class="cf-hero-tag">
                        ${escapeHtml(tag)}
                    </div>

                    <h1 class="cf-hero-title">
                        ${escapeHtml(item.Name || '')}
                    </h1>

                    <div class="cf-hero-desc">
                        ${escapeHtml(overview)}
                    </div>

                    <div class="cf-hero-buttons">

                        <button
                            type="button"
                            class="cf-btn-play"
                            data-crackflix-action="play">
                            PLAY
                        </button>

                        <button
                            type="button"
                            class="cf-btn-info"
                            data-crackflix-action="info">
                            MORE INFO
                        </button>

                    </div>

                </div>
            `;


            /* -------------------------------------------------------------
               BUTTON ACTIONS
               ------------------------------------------------------------- */

            const playButton =
                hero.querySelector('[data-crackflix-action="play"]');

            const infoButton =
                hero.querySelector('[data-crackflix-action="info"]');


            const openItem = () => {

                if (
                    typeof Emby !== 'undefined' &&
                    Emby.Page &&
                    typeof Emby.Page.showItem === 'function'
                ) {
                    Emby.Page.showItem(item);
                    return;
                }

                if (item.Id) {
                    window.location.href =
                        `#/item?id=${encodeURIComponent(item.Id)}`;
                }
            };


            if (playButton) {
                playButton.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    openItem();
                });
            }


            if (infoButton) {
                infoButton.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    openItem();
                });
            }


            /*
             * Hero plaatsen vóór de oorspronkelijke Jellyfin content.
             */
            target.parentNode.insertBefore(hero, target);
        });
    }


    /* =====================================================================
       VIDEO PLAYER EPISODE POPUP
       ===================================================================== */

    function findVideoAppBar() {

        return (
            document.querySelector('.videoOsd-appBar') ||
            document.querySelector('.MuiToolbar-root.videoOsd-appBar') ||
            document.querySelector('.videoOsdHeader .MuiToolbar-root')
        );
    }


    function injectEpisodePopup() {

        const appBar = findVideoAppBar();

        if (!appBar) {
            return;
        }


        /*
         * Trigger bestaat al.
         */
        let trigger =
            appBar.querySelector('.cf-episodes-trigger');


        /*
         * Overlay bestaat al.
         */
        let overlay =
            document.querySelector('.cf-episodes-overlay');


        /* -------------------------------------------------------------
           TRIGGER BUTTON
           ------------------------------------------------------------- */

        if (!trigger) {

            trigger = document.createElement('button');

            trigger.type = 'button';

            trigger.className =
                'MuiButtonBase-root ' +
                'MuiIconButton-root ' +
                'MuiIconButton-colorInherit ' +
                'MuiIconButton-sizeLarge ' +
                'cf-episodes-trigger';

            trigger.setAttribute(
                'aria-label',
                'Episodes Selection'
            );

            trigger.innerHTML = `
                <span class="material-icons">
                    list_alt
                </span>
            `;

            trigger.style.cssText = `
                color: #ffffff;
                margin-left: 8px;
                margin-right: 8px;
                cursor: pointer;
                background: transparent;
                border: none;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 8px;
            `;

            appBar.appendChild(trigger);
        }


        /* -------------------------------------------------------------
           OVERLAY
           ------------------------------------------------------------- */

        if (!overlay) {

            overlay = document.createElement('aside');

            overlay.className = 'cf-episodes-overlay';

            overlay.innerHTML = `
                <div class="cf-episodes-panel">

                    <div class="cf-episodes-header">

                        <h2>
                            EPISODES
                        </h2>

                        <button
                            type="button"
                            class="cf-episodes-close"
                            aria-label="Close Episodes">

                            <span class="material-icons">
                                close
                            </span>

                        </button>

                    </div>

                    <div class="cf-episodes-content">

                        <p>
                            Select an episode directly from
                            the timeline context.
                        </p>

                        <span class="material-icons">
                            sync
                        </span>

                    </div>

                </div>
            `;

            document.body.appendChild(overlay);
        }


        /* -------------------------------------------------------------
           OPEN / CLOSE
           ------------------------------------------------------------- */

        if (!trigger.dataset.crackflixBound) {

            trigger.addEventListener('click', event => {

                event.preventDefault();
                event.stopPropagation();

                overlay.classList.add('is-open');
            });

            trigger.dataset.crackflixBound = 'true';
        }


        const closeButton =
            overlay.querySelector('.cf-episodes-close');


        if (
            closeButton &&
            !closeButton.dataset.crackflixBound
        ) {

            closeButton.addEventListener('click', event => {

                event.preventDefault();
                event.stopPropagation();

                overlay.classList.remove('is-open');
            });

            closeButton.dataset.crackflixBound = 'true';
        }
    }


    /* =====================================================================
       SINGLE GLOBAL OBSERVER
       ===================================================================== */

    const crackFlixObserver =
        new MutationObserver(() => {
            scheduleUpdate();
        });


    crackFlixObserver.observe(document.body, {
        childList: true,
        subtree: true
    });


    /* =====================================================================
       INITIAL START
       ===================================================================== */

    scheduleUpdate();

})();