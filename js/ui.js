'use strict';

const UI = {
    elements: {},

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupMultiplayerCallbacks();

        const roomCode = Multiplayer.getRoomFromURL();
        if (roomCode) {
            this.showModal();
            this.showSection('joining');
            Multiplayer.joinRoom(roomCode).catch(() => {
                this.showSection('menu');
            });
        }
    },

    cacheElements() {
        this.elements = {
            multiplayerBtn: document.getElementById('multiplayer-btn'),
            modalOverlay: document.getElementById('modal-overlay'),
            menuSection: document.getElementById('section-menu'),
            createNicknameSection: document.getElementById('section-create-nickname'),
            createWaitingSection: document.getElementById('section-create-waiting'),
            joinSection: document.getElementById('section-join'),
            joiningSection: document.getElementById('section-joining'),
            connectedSection: document.getElementById('section-connected'),
            btnCreate: document.getElementById('btn-create'),
            btnCreateSubmit: document.getElementById('btn-create-submit'),
            btnJoin: document.getElementById('btn-join'),
            btnJoinSubmit: document.getElementById('btn-join-submit'),
            btnBack: document.querySelectorAll('.btn-back'),
            btnDisconnect: document.getElementById('btn-disconnect'),
            btnRematch: document.getElementById('btn-rematch'),
            roomCodeValue: document.getElementById('room-code-value'),
            roomCodeUrl: document.getElementById('room-code-url'),
            createNicknameInput: document.getElementById('create-nickname-input'),
            joinNicknameInput: document.getElementById('join-nickname-input'),
            joinCodeInput: document.getElementById('join-code-input'),
            scoreDisplay: document.getElementById('score-display'),
            scoreValue: document.getElementById('score-value'),
            matchEndOverlay: document.getElementById('match-end-overlay'),
            matchResult: document.getElementById('match-result'),
            cardboardBox: document.getElementById('cardboard-box'),
            remoteRobot: document.getElementById('remote-robot'),
            countdownOverlay: document.getElementById('countdown-overlay'),
            countdownNumber: document.getElementById('countdown-number')
        };
    },

    bindEvents() {
        this.elements.multiplayerBtn?.addEventListener('click', () => {
            if (Multiplayer.isConnected()) {
                this.showModal();
                this.showSection('connected');
            } else {
                this.showModal();
                this.showSection('menu');
            }
        });

        this.elements.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.hideModal();
            }
        });

        this.elements.btnCreate?.addEventListener('click', () => this.showSection('create-nickname'));
        this.elements.btnCreateSubmit?.addEventListener('click', () => this.createRoom());
        this.elements.btnJoin?.addEventListener('click', () => this.showSection('join'));
        this.elements.btnJoinSubmit?.addEventListener('click', () => this.joinRoom());
        this.elements.btnDisconnect?.addEventListener('click', () => this.disconnect());
        this.elements.btnRematch?.addEventListener('click', () => this.rematch());

        this.elements.btnBack?.forEach(btn => {
            btn.addEventListener('click', () => {
                if (Multiplayer.isActive()) {
                    Multiplayer.disconnect();
                }
                this.showSection('menu');
            });
        });

        this.elements.joinCodeInput?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        this.elements.createNicknameInput?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
                this.hideMatchEnd();
            }
        });
    },

    setupMultiplayerCallbacks() {
        Multiplayer.onConnectionChange = (state, roomCode) => {
            this.updateConnectionState(state, roomCode);
        };

        Multiplayer.onScoreChange = (score) => {
            this.updateScore(score);
        };

        Multiplayer.onMatchEnd = (isVictory) => {
            this.showMatchEnd(isVictory);
        };

        Multiplayer.onRemoteFall = () => {
            this.flashScore();
            const name = Multiplayer.remoteNickname || 'Oponente';
            this.showRoundResult(`${name} caiu!`);
        };

        Multiplayer.onLocalFall = () => {
            this.showRoundResult('Você caiu!');
        };

        Multiplayer.onRemoteRematch = () => {
            this.hideMatchEnd();
            this.resetGameWithCountdown();
        };
    },

    showModal() {
        this.elements.modalOverlay?.classList.add('active');
    },

    hideModal() {
        this.elements.modalOverlay?.classList.remove('active');
    },

    showSection(section) {
        document.querySelectorAll('.modal-section').forEach(el => {
            el.classList.remove('active');
        });

        const sectionMap = {
            'menu': this.elements.menuSection,
            'create-nickname': this.elements.createNicknameSection,
            'create-waiting': this.elements.createWaitingSection,
            'join': this.elements.joinSection,
            'joining': this.elements.joiningSection,
            'connected': this.elements.connectedSection
        };

        sectionMap[section]?.classList.add('active');
    },

    async createRoom() {
        const nickname = this.elements.createNicknameInput?.value?.trim();
        if (!nickname) {
            this.elements.createNicknameInput?.focus();
            return;
        }

        Multiplayer.localNickname = nickname;
        this.showSection('create-waiting');

        try {
            const code = await Multiplayer.createRoom();
            if (this.elements.roomCodeValue) {
                this.elements.roomCodeValue.textContent = code;
            }
            if (this.elements.roomCodeUrl) {
                this.elements.roomCodeUrl.textContent = Multiplayer.getShareURL();
            }
        } catch (err) {
            console.error('Failed to create room:', err);
            this.showSection('menu');
        }
    },

    async joinRoom() {
        const code = this.elements.joinCodeInput?.value?.trim();
        if (!code || code.length < 6) return;

        const nickname = this.elements.joinNicknameInput?.value?.trim() || 'Jogador';
        Multiplayer.localNickname = nickname;

        this.showSection('joining');

        try {
            await Multiplayer.joinRoom(code);
        } catch (err) {
            console.error('Failed to join room:', err);
            this.showSection('join');
        }
    },

    disconnect() {
        Multiplayer.disconnect();
        this.hideModal();
        this.disableMultiplayer();
    },

    rematch() {
        Multiplayer.sendRematch();
        this.hideMatchEnd();
        this.resetGameWithCountdown();
    },

    resetGameWithCountdown() {
        const localRobot = document.getElementById('robot-player');
        const component = localRobot?.components['sumo-controls'];

        if (component) {
            component.resetRobot();
            component.freeze();
        }

        this.startCountdown(() => {
            component?.unfreeze();
        });
    },

    updateConnectionState(state, _roomCode) {
        const btn = this.elements.multiplayerBtn;

        if (state === MultiplayerState.CONNECTED) {
            btn?.classList.add('connected');
            if (btn) btn.textContent = 'Conectado';

            this.showSection('connected');
            this.hideModal();
            this.enableMultiplayer();
        } else if (state === MultiplayerState.DISCONNECTED) {
            btn?.classList.remove('connected');
            if (btn) btn.textContent = 'Multiplayer';

            this.disableMultiplayer();
        } else if (state === MultiplayerState.WAITING) {
            if (btn) btn.textContent = 'Aguardando...';
        }
    },

    enableMultiplayer() {
        if (this.elements.cardboardBox) {
            this.elements.cardboardBox.setAttribute('visible', false);
        }

        if (this.elements.remoteRobot) {
            this.elements.remoteRobot.setAttribute('visible', true);
            this.elements.remoteRobot.setAttribute('remote-robot', 'enabled: true');
        }

        this.elements.scoreDisplay?.classList.add('active');
        this.updateScore({ local: 0, remote: 0 });

        const localRobot = document.getElementById('robot-player');
        const component = localRobot?.components['sumo-controls'];

        if (component) {
            component.enableMultiplayer();
            component.freeze();
        }
        if (localRobot) {
            this.setRobotColor(localRobot, '#4a7c59', '#2d4a35', '#3d6b47');
        }

        if (this.elements.remoteRobot) {
            this.setRobotColor(this.elements.remoteRobot, '#8b4a4a', '#5c2d2d', '#6b3d3d');
        }

        const playerRig = document.getElementById('player-rig');
        if (playerRig) {
            if (Multiplayer.isHost) {
                playerRig.setAttribute('position', '0 0 2.2');
                playerRig.setAttribute('rotation', '-35 0 0');
            } else {
                playerRig.setAttribute('position', '0 0 -2.2');
                playerRig.setAttribute('rotation', '-35 180 0');
            }
        }

        this.startCountdown(() => {
            component?.unfreeze();
        });
    },

    disableMultiplayer() {
        if (this.elements.cardboardBox) {
            this.elements.cardboardBox.setAttribute('visible', true);
        }

        if (this.elements.remoteRobot) {
            this.elements.remoteRobot.setAttribute('visible', false);
            this.elements.remoteRobot.setAttribute('remote-robot', 'enabled: false');
        }

        this.elements.scoreDisplay?.classList.remove('active');

        const localRobot = document.getElementById('robot-player');
        if (localRobot) {
            const component = localRobot.components['sumo-controls'];
            if (component) {
                component.disableMultiplayer();
            }
            this.setRobotColor(localRobot, '#555', '#333', '#444');
        }

        const playerRig = document.getElementById('player-rig');
        if (playerRig) {
            playerRig.setAttribute('position', '0 0 2.2');
            playerRig.setAttribute('rotation', '-35 0 0');
        }
    },

    setRobotColor(robot, bodyColor, panelColor, wedgeColor) {
        const body = robot.querySelector('.robot-body');
        const panel = robot.querySelector('.robot-panel');
        const wedge = robot.querySelector('.robot-wedge');

        if (body) body.setAttribute('color', bodyColor);
        if (panel) panel.setAttribute('color', panelColor);
        if (wedge) wedge.setAttribute('color', wedgeColor);
    },

    updateScore(score) {
        if (this.elements.scoreValue) {
            this.elements.scoreValue.textContent = `${score.local} × ${score.remote}`;
        }
    },

    flashScore() {
        this.elements.scoreDisplay?.classList.add('flash');
        setTimeout(() => {
            this.elements.scoreDisplay?.classList.remove('flash');
        }, 500);
    },

    showMatchEnd(isVictory) {
        if (this.elements.matchResult) {
            this.elements.matchResult.textContent = isVictory ? 'Vitória!' : 'Derrota!';
            this.elements.matchResult.className = 'match-result ' + (isVictory ? 'victory' : 'defeat');
        }
        this.elements.matchEndOverlay?.classList.add('active');
    },

    hideMatchEnd() {
        this.elements.matchEndOverlay?.classList.remove('active');
    },

    startCountdown(onComplete) {
        const overlay = this.elements.countdownOverlay;
        const number = this.elements.countdownNumber;
        if (!overlay || !number) {
            onComplete?.();
            return;
        }

        let count = 3;
        number.textContent = count;
        number.style.animation = 'none';
        number.offsetHeight;
        number.style.animation = 'countdownPulse 0.5s ease-in-out';
        overlay.classList.add('active');

        const tick = () => {
            count--;
            if (count > 0) {
                number.textContent = count;
                number.style.animation = 'none';
                number.offsetHeight;
                number.style.animation = 'countdownPulse 0.5s ease-in-out';
                setTimeout(tick, 500);
            } else {
                overlay.classList.remove('active');
                onComplete?.();
            }
        };

        setTimeout(tick, 500);
    },

    showRoundResult(text) {
        const overlay = this.elements.countdownOverlay;
        const number = this.elements.countdownNumber;
        if (!overlay || !number) return;

        number.textContent = text;
        number.style.animation = 'none';
        number.offsetHeight;
        number.style.animation = 'countdownPulse 1s ease-in-out';
        overlay.classList.add('active');

        setTimeout(() => {
            overlay.classList.remove('active');
        }, 1000);
    },

    resetGame() {
        const localRobot = document.getElementById('robot-player');
        if (localRobot) {
            const component = localRobot.components['sumo-controls'];
            if (component) {
                component.resetRobot();
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
