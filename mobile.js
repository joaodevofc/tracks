/*
 * W.TRACKS — PWA MOBILE
 * Instalação para dispositivos móveis (iOS/Android)
 */

(function () {
    'use strict';

    // Só executa em mobile
    function isMobile() {
        return /iphone|ipad|ipod|android/i.test(window.navigator.userAgent);
    }

    if (!isMobile()) {
        console.info('[W.Tracks Mobile] Dispositivo desktop detectado, usando pwa.js');
        return; // Não executa o código de PWA mobile em desktop
    }

    let deferredInstallPrompt = null;

    const INSTALL_BUTTON_SELECTOR = '.welcome-download-device';

    /* ============================================================
       DETECÇÃO
       ============================================================ */

    function isStandalone() {
        return (
            window.matchMedia &&
            window.matchMedia('(display-mode: standalone)').matches
        ) || window.navigator.standalone === true;
    }

    function isIOS() {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    }

    function isAndroid() {
        return /android/i.test(window.navigator.userAgent);
    }

    function isMobile() {
        return isIOS() || isAndroid();
    }

    /* ============================================================
       BOTÃO
       ============================================================ */

    function getInstallButtons() {
        return Array.from(
            document.querySelectorAll(INSTALL_BUTTON_SELECTOR)
        );
    }

    function updateInstallButton() {
        const buttons = getInstallButtons();

        if (!buttons.length) {
            return;
        }

        const installed = isStandalone();

        buttons.forEach(button => {
            if (installed) {
                // Esconde o botão quando o PWA está instalado
                button.style.display = 'none';
                button.setAttribute('data-pwa-installed', 'true');
                button.setAttribute(
                    'aria-label',
                    'W.Tracks instalado no seu dispositivo'
                );
            } else {
                // Mostra o botão quando não está instalado
                button.style.display = '';
                button.removeAttribute('data-pwa-installed');
                button.setAttribute(
                    'aria-label',
                    'Baixe no seu dispositivo'
                );
            }
        });

        // Esconde o container de download quando o PWA está instalado
        const downloadContainer = document.querySelector('.welcome-download-icons');
        if (downloadContainer) {
            if (installed) {
                downloadContainer.style.display = 'none';
                downloadContainer.setAttribute('data-pwa-installed', 'true');
            } else {
                downloadContainer.style.display = '';
                downloadContainer.removeAttribute('data-pwa-installed');
            }
        }
    }

    /* ============================================================
       INSTALAÇÃO
       ============================================================ */

    async function installPWA() {
        /*
         * Se o navegador disponibilizou o prompt nativo,
         * usamos o próprio sistema do navegador.
         */
        if (deferredInstallPrompt) {
            try {
                deferredInstallPrompt.prompt();

                const result = await deferredInstallPrompt.userChoice;

                if (result && result.outcome === 'accepted') {
                    console.info('[W.Tracks Mobile] Instalação aceita.');
                } else {
                    console.info('[W.Tracks Mobile] Instalação cancelada.');
                }
            } catch (error) {
                console.warn(
                    '[W.Tracks Mobile] Não foi possível abrir o instalador:',
                    error
                );
            } finally {
                deferredInstallPrompt = null;
                updateInstallButton();
            }

            return;
        }

        /*
         * Quando o navegador não oferece beforeinstallprompt,
         * não tentamos criar um instalador falso.
         *
         * Chrome/Edge podem mostrar a opção de instalação
         * no próprio menu do navegador.
         */
        if (isStandalone()) {
            console.info('[W.Tracks Mobile] O W.Tracks já está instalado.');
            return;
        }

        console.info(
            '[W.Tracks Mobile] O navegador não disponibilizou o prompt automático.'
        );

        /*
         * Ajuda visual simples, sem alterar o restante do site.
         */
        showInstallHelp();
    }

    /* ============================================================
       AJUDA
       ============================================================ */

    function showInstallHelp() {
        let message = '';

        if (isIOS()) {
            message = 'Para instalar o W.Tracks no seu iPhone/iPad: toque no botão de compartilhar e selecione "Adicionar à Tela de Início".';
        } else if (isAndroid()) {
            message = 'Para instalar o W.Tracks no seu Android: toque no menu do navegador e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".';
        } else {
            message = 'Para instalar o W.Tracks, procure a opção de instalação no menu do navegador.';
        }

        console.info(message);

        /*
         * Mantemos um feedback discreto para o usuário.
         */
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        }
    }

    /* ============================================================
       BEFORE INSTALL PROMPT
       ============================================================ */

    window.addEventListener('beforeinstallprompt', event => {
        /*
         * Impede o navegador de abrir automaticamente.
         * O usuário controla a instalação pelo botão.
         */
        event.preventDefault();

        deferredInstallPrompt = event;

        console.info(
            '[W.Tracks Mobile] Instalação disponível.',
            'Browser:', navigator.userAgent
        );

        updateInstallButton();
    });

    /* ============================================================
       INSTALADO
       ============================================================ */

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;

        console.info(
            '[W.Tracks Mobile] W.Tracks instalado com sucesso.'
        );

        updateInstallButton();
    });

    /* ============================================================
       CLICK
       ============================================================ */

    document.addEventListener('click', event => {
        const button = event.target.closest(
            INSTALL_BUTTON_SELECTOR
        );

        if (!button) {
            return;
        }

        /*
         * Impede o href="#" de jogar a página para o topo.
         */
        event.preventDefault();

        installPWA();
    });

    /* ============================================================
       SERVICE WORKER
       ============================================================ */

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.info(
                '[W.Tracks Mobile] Service Worker não suportado.'
            );
            return;
        }

        /*
         * PWA exige HTTPS em produção.
         * localhost também é considerado seguro para desenvolvimento.
         */
        const isSecureContext =
            window.isSecureContext ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (!isSecureContext) {
            console.warn(
                '[W.Tracks Mobile] Service Worker não registrado porque a página não está em HTTPS.',
                'hostname:', window.location.hostname,
                'isSecureContext:', window.isSecureContext
            );
            return;
        }

        try {
            const registration =
                await navigator.serviceWorker.register('./sw.js', {
                    scope: './'
                });

            console.info(
                '[W.Tracks Mobile] Service Worker registrado:',
                registration.scope,
                'active:', !!registration.active,
                'installing:', !!registration.installing,
                'waiting:', !!registration.waiting
            );

            /*
             * Verifica atualizações quando a página abre.
             */
            registration.update().catch(() => {});
        } catch (error) {
            console.error(
                '[W.Tracks Mobile] Erro ao registrar Service Worker:',
                error
            );
        }
    }

    /* ============================================================
       INICIALIZAÇÃO
       ============================================================ */

    function initializePWA() {
        updateInstallButton();
        registerServiceWorker();

        /*
         * Atualiza quando o modo de exibição mudar.
         */
        if (window.matchMedia) {
            const mediaQuery =
                window.matchMedia('(display-mode: standalone)');

            const handleDisplayModeChange = () => {
                updateInstallButton();
            };

            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener(
                    'change',
                    handleDisplayModeChange
                );
            } else if (mediaQuery.addListener) {
                mediaQuery.addListener(
                    handleDisplayModeChange
                );
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initializePWA,
            { once: true }
        );
    } else {
        initializePWA();
    }

    /*
     * Disponibiliza diagnóstico mínimo para o modo DEV.
     */
    window.WTracksMobile = {
        isStandalone,
        isMobile,
        isIOS,
        isAndroid,
        install: installPWA,
        getInstallPromptAvailable: () =>
            !!deferredInstallPrompt
    };

})();
