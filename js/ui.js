'use strict';

const UI = {
    elements: {},
    joysticksVisible: false,

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupMultiplayerCallbacks();
        this.loadJoystickPreference();

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
            btnCopyUrl: document.getElementById('btn-copy-url'),
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
            countdownNumber: document.getElementById('countdown-number'),
            fpvIndicator: document.getElementById('fpv-indicator'),
            toast: document.getElementById('toast'),
            joysticksContainer: document.getElementById('joysticks-container'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsPanel: document.getElementById('settings-panel'),
            settingsClose: document.getElementById('settings-close'),
            settingNormalSpeed: document.getElementById('setting-normal-speed'),
            settingSlowSpeed: document.getElementById('setting-slow-speed'),
            valueNormalSpeed: document.getElementById('value-normal-speed'),
            valueSlowSpeed: document.getElementById('value-slow-speed'),
            resetNormalSpeed: document.getElementById('reset-normal-speed'),
            resetSlowSpeed: document.getElementById('reset-slow-speed'),
            settingObstacle: document.getElementById('setting-obstacle'),
            trainingCones: document.getElementById('training-cones'),
            laserTarget: document.getElementById('laser-target'),
            settingObstacleDifficulty: document.getElementById('setting-obstacle-difficulty'),
            valueObstacleDifficulty: document.getElementById('value-obstacle-difficulty'),
            resetObstacleDifficulty: document.getElementById('reset-obstacle-difficulty')
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
        this.elements.btnCopyUrl?.addEventListener('click', () => this.copyRoomUrl());

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
                this.hideSettings();
            }
        });

        this.elements.settingsBtn?.addEventListener('click', () => this.toggleSettings());
        this.elements.settingsClose?.addEventListener('click', () => this.hideSettings());

        this.elements.settingNormalSpeed?.addEventListener('input', (e) => {
            Settings.normalSpeed = parseFloat(e.target.value);
            this.elements.valueNormalSpeed.textContent = e.target.value;
            this.updateResetButton(this.elements.resetNormalSpeed, e.target.value, '1');
        });
        this.elements.settingSlowSpeed?.addEventListener('input', (e) => {
            Settings.slowSpeed = parseFloat(e.target.value);
            this.elements.valueSlowSpeed.textContent = e.target.value;
            this.updateResetButton(this.elements.resetSlowSpeed, e.target.value, '0.3');
        });

        this.elements.resetNormalSpeed?.addEventListener('click', () => {
            this.resetSetting(this.elements.settingNormalSpeed, this.elements.valueNormalSpeed, this.elements.resetNormalSpeed, 1.0, 'normalSpeed');
        });
        this.elements.resetSlowSpeed?.addEventListener('click', () => {
            this.resetSetting(this.elements.settingSlowSpeed, this.elements.valueSlowSpeed, this.elements.resetSlowSpeed, 0.3, 'slowSpeed');
        });

        this.elements.settingObstacle?.addEventListener('change', (e) => {
            this.setObstacle(e.target.value);
        });

        this.elements.settingObstacleDifficulty?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            Settings.obstacleDifficulty = value;
            this.elements.valueObstacleDifficulty.textContent = value;
            this.updateResetButton(this.elements.resetObstacleDifficulty, value, '5');
            this.applyObstacleDifficulty();
        });

        this.elements.resetObstacleDifficulty?.addEventListener('click', () => {
            this.resetSetting(
                this.elements.settingObstacleDifficulty,
                this.elements.valueObstacleDifficulty,
                this.elements.resetObstacleDifficulty,
                5,
                'obstacleDifficulty'
            );
            this.applyObstacleDifficulty();
        });

        // Make key hint buttons clickable
        const KEY_PRESS_DURATION = 100; // Duration in ms for simulated key press
        const keyCodeToKey = {
            'KeyW': 'w', 'KeyA': 'a', 'KeyS': 's', 'KeyD': 'd',
            'KeyV': 'v', 'KeyR': 'r', 'KeyJ': 'j'
        };
        
        document.querySelectorAll('.key[data-key]').forEach(keyElement => {
            keyElement.addEventListener('click', (e) => {
                e.preventDefault();
                const keyCode = keyElement.getAttribute('data-key');
                const key = keyCodeToKey[keyCode] || keyElement.textContent.toLowerCase();
                
                // Simulate a keydown event
                const keydownEvent = new KeyboardEvent('keydown', {
                    code: keyCode,
                    key: key,
                    bubbles: true,
                    cancelable: true
                });
                window.dispatchEvent(keydownEvent);
                
                // For WASD keys, also simulate keyup after a short delay
                if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(keyCode)) {
                    setTimeout(() => {
                        const keyupEvent = new KeyboardEvent('keyup', {
                            code: keyCode,
                            key: key,
                            bubbles: true,
                            cancelable: true
                        });
                        window.dispatchEvent(keyupEvent);
                    }, KEY_PRESS_DURATION);
                }
            });
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
            const name = Multiplayer.remoteNickname || 'Opponent';
            this.showRoundResult(`${name} fell!`);
        };

        Multiplayer.onLocalFall = () => {
            this.showRoundResult('You fell!');
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
        } catch (err) {
            console.error('Failed to create room:', err);
            this.showSection('menu');
        }
    },

    async joinRoom() {
        const code = this.elements.joinCodeInput?.value?.trim();
        if (!code || code.length < 6) return;

        const nickname = this.elements.joinNicknameInput?.value?.trim() || 'Player';
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

    copyRoomUrl() {
        const url = Multiplayer.getShareURL();
        navigator.clipboard.writeText(url).then(() => {
            const btn = this.elements.btnCopyUrl;
            if (btn) {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = 'Copy Link';
                    btn.classList.remove('copied');
                }, 2000);
            }
        });
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
            if (btn) btn.textContent = 'Connected';

            this.showSection('connected');
            this.hideModal();
            this.enableMultiplayer();
        } else if (state === MultiplayerState.DISCONNECTED) {
            btn?.classList.remove('connected');
            if (btn) btn.textContent = 'Multiplayer';

            this.disableMultiplayer();
        } else if (state === MultiplayerState.WAITING) {
            if (btn) btn.textContent = 'Waiting...';
        }
    },

    enableMultiplayer() {
        if (this.elements.cardboardBox) {
            this.elements.cardboardBox.setAttribute('visible', false);
        }
        if (this.elements.trainingCones) {
            this.elements.trainingCones.setAttribute('visible', false);
        }
        if (this.elements.laserTarget) {
            this.elements.laserTarget.setAttribute('visible', false);
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
        const obstacleType = this.elements.settingObstacle?.value || 'box';
        this.setObstacle(obstacleType);

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
            this.elements.matchResult.textContent = isVictory ? 'Victory!' : 'Defeat!';
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
    },

    updateFPVIndicator(isActive) {
        if (isActive) {
            this.elements.fpvIndicator?.classList.add('active');
        } else {
            this.elements.fpvIndicator?.classList.remove('active');
        }
    },

    toggleSettings() {
        this.elements.settingsPanel?.classList.toggle('active');
    },

    hideSettings() {
        this.elements.settingsPanel?.classList.remove('active');
    },

    updateResetButton(btn, currentValue, defaultValue) {
        if (!btn) return;
        if (parseFloat(currentValue) !== parseFloat(defaultValue)) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    },

    resetSetting(input, valueEl, resetBtn, defaultValue, settingKey) {
        if (!input) return;
        input.value = defaultValue;
        if (valueEl) valueEl.textContent = defaultValue;
        if (resetBtn) resetBtn.classList.remove('visible');
        Settings[settingKey] = defaultValue;
    },

    setObstacle(type) {
        this.elements.cardboardBox?.setAttribute('visible', type === 'box');
        this.elements.trainingCones?.setAttribute('visible', type === 'cones');
        this.elements.laserTarget?.setAttribute('visible', type === 'laser');
    },

    applyObstacleDifficulty() {
        const difficulty = Settings.obstacleDifficulty;
        const coneDistance = 0.15 + (10 - difficulty) * 0.04;
        const cones = this.elements.trainingCones?.querySelectorAll('.training-cone');
        if (cones && cones.length >= 2) {
            cones[0].setAttribute('position', `0 0.26 ${-coneDistance}`);
            cones[1].setAttribute('position', `0 0.26 ${coneDistance}`);
        }
    },

    loadJoystickPreference() {
        // Check if there's a saved preference, default to true on mobile, false on desktop
        const savedPref = localStorage.getItem('joysticksVisible');
        if (savedPref !== null) {
            this.joysticksVisible = savedPref === 'true';
        } else {
            // Auto-detect: show on mobile by default
            this.joysticksVisible = window.innerWidth <= 768;
        }
        this.updateJoysticksVisibility();
    },

    toggleJoysticks() {
        this.joysticksVisible = !this.joysticksVisible;
        localStorage.setItem('joysticksVisible', this.joysticksVisible);
        this.updateJoysticksVisibility();
    },

    updateJoysticksVisibility() {
        if (this.joysticksVisible) {
            this.elements.joysticksContainer?.classList.add('visible');
        } else {
            this.elements.joysticksContainer?.classList.remove('visible');
        }
    },

    showToast(message) {
        const toast = this.elements.toast;
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('active');

        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.remove('active');
        }, 2000);
    },

    cycleObstacle(direction) {
        const obstacles = ['box', 'cones', 'laser', 'none'];
        const labels = { box: 'Box', cones: 'Cones', laser: 'Laser', none: 'None' };
        const select = this.elements.settingObstacle;
        if (!select) return;

        const currentIndex = obstacles.indexOf(select.value);
        const newIndex = (currentIndex + direction + obstacles.length) % obstacles.length;
        const newValue = obstacles[newIndex];

        select.value = newValue;
        this.setObstacle(newValue);
        this.showToast(`Obstacle: ${labels[newValue]}`);
    },

    cycleDifficulty() {
        const current = Settings.obstacleDifficulty;
        const newValue = current >= 10 ? 1 : current + 1;

        Settings.obstacleDifficulty = newValue;

        if (this.elements.settingObstacleDifficulty) {
            this.elements.settingObstacleDifficulty.value = newValue;
        }
        if (this.elements.valueObstacleDifficulty) {
            this.elements.valueObstacleDifficulty.textContent = newValue;
        }
        this.updateResetButton(this.elements.resetObstacleDifficulty, newValue, '5');
        this.applyObstacleDifficulty();
        this.showToast(`Difficulty: ${newValue}`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
