'use strict';

const ROBOT_COLLISION_DISTANCE = 0.22;
const PUSH_STRENGTH = 0.08;

function distanceFromCenter(x, z) {
    return Math.sqrt(x * x + z * z);
}

function updateStatusDisplay(text, isWarning) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;

    statusEl.textContent = text;
    statusEl.className = isWarning ? 'status-warning' : '';
}

AFRAME.registerComponent('sumo-controls', {
    schema: {
        moveSpeed: { type: 'number', default: PHYSICS.moveSpeed },
        rotationSpeed: { type: 'number', default: PHYSICS.rotationSpeed }
    },

    init() {
        this.status = GameStatus.PLAYING;
        this.fallVelocity = 0;
        this.isMultiplayer = false;
        this.hasFallen = false;
        this.isFrozen = false;
        this.isFPV = false;

        this.startPosition = new THREE.Vector3(0, POSITIONS.robotInitialY, 0.4);
        this.startRotation = new THREE.Euler(0, Math.PI, 0);
        this.prevPosition = new THREE.Vector3();
        this.pushVelocity = new THREE.Vector3();

        this.playerRig = document.getElementById('player-rig');
        this.savedCameraPos = new THREE.Vector3();
        this.savedCameraRot = new THREE.Euler();

        InputHandler.init(this.resetRobot.bind(this), this.toggleFPV.bind(this));
        this.setupMultiplayerCallbacks();
        this.resetRobot();
    },

    remove() {
        InputHandler.cleanup();
    },

    setupMultiplayerCallbacks() {
        Multiplayer.onRemoteReset = () => {
            this.resetRobot();
            this.freeze();
            UI.startCountdown(() => {
                this.unfreeze();
            });
        };

        Multiplayer.onPushReceived = (push) => {
            const pos = this.el.object3D.position;
            pos.x += push.x;
            pos.z += push.z;
        };
    },

    enableMultiplayer() {
        this.isMultiplayer = true;
        this.hasFallen = false;

        if (this.isFPV) {
            this.toggleFPV();
        }

        if (Multiplayer.isHost) {
            this.startPosition.set(0, POSITIONS.robotInitialY, 0.4);
            this.startRotation.set(0, 0, 0);
        } else {
            this.startPosition.set(0, POSITIONS.robotInitialY, -0.4);
            this.startRotation.set(0, Math.PI, 0);
        }

        this.resetRobot();
    },

    disableMultiplayer() {
        this.isMultiplayer = false;
        this.hasFallen = false;
        this.isFrozen = false;

        if (this.isFPV) {
            this.toggleFPV();
        }

        this.startPosition.set(0, POSITIONS.robotInitialY, 0.4);
        this.startRotation.set(0, Math.PI, 0);

        this.resetRobot();
    },

    freeze() {
        this.isFrozen = true;
    },

    unfreeze() {
        this.isFrozen = false;
    },

    toggleFPV() {
        if (!this.playerRig) return;

        this.isFPV = !this.isFPV;

        if (this.isFPV) {
            this.savedCameraPos.copy(this.playerRig.object3D.position);
            this.savedCameraRot.copy(this.playerRig.object3D.rotation);
        } else {
            this.playerRig.object3D.position.copy(this.savedCameraPos);
            this.playerRig.object3D.rotation.copy(this.savedCameraRot);
        }

        UI.updateFPVIndicator(this.isFPV);
    },

    updateFPVCamera() {
        if (!this.isFPV || !this.playerRig) return;

        const robotPos = this.el.object3D.position;
        const robotRot = this.el.object3D.rotation;

        this.playerRig.object3D.position.set(robotPos.x, robotPos.y - 1.5, robotPos.z);
        this.playerRig.object3D.rotation.set(0, robotRot.y, 0);
    },

    resetRobot() {
        const { position, rotation } = this.el.object3D;

        position.copy(this.startPosition);
        rotation.copy(this.startRotation);

        this.status = GameStatus.PLAYING;
        this.fallVelocity = 0;
        this.hasFallen = false;
        this.pushVelocity.set(0, 0, 0);
        this.prevPosition.copy(this.startPosition);

        updateStatusDisplay('', false);
    },

    tick(_time, timeDelta) {
        if (this.isFrozen) return;

        const { position } = this.el.object3D;

        if (position.y < POSITIONS.fallThresholdY) {
            if (this.isMultiplayer && !this.hasFallen) {
                this.hasFallen = true;
                Multiplayer.sendFall();

                setTimeout(() => {
                    if (!Multiplayer.matchOver) {
                        this.resetRobot();
                        this.freeze();
                        Multiplayer.sendReset();
                        UI.startCountdown(() => {
                            this.unfreeze();
                        });
                    }
                }, MULTIPLAYER_CONFIG.resetDelayMs);
            }
            updateStatusDisplay('Caiu!', true);
            return;
        }

        const dt = timeDelta / 1000;

        if (this.status === GameStatus.FALLING) {
            this.updateFalling(dt);
            return;
        }

        this.updateMovement(dt);
        this.updateFPVCamera();

        if (this.isMultiplayer) {
            this.handleRemoteRobotCollision();
            this.sendStateToRemote();
        }

        this.checkBoundary();
    },

    updateMovement(dt) {
        const { drive, turn } = InputHandler.getInputState();
        const { rotation, position } = this.el.object3D;

        rotation.y += turn * this.data.rotationSpeed * dt;

        const speed = drive * this.data.moveSpeed;
        position.x += Math.sin(rotation.y) * speed * dt;
        position.z += Math.cos(rotation.y) * speed * dt;

        position.y = POSITIONS.robotInitialY;

        const dist = distanceFromCenter(position.x, position.z);
        const dangerZone = SUMO_SPECS.dohyo.radiusM * 0.85;

        if (dist > dangerZone) {
            const percentage = Math.min(100, Math.round(
                ((dist - dangerZone) / (POSITIONS.boundaryRadius - dangerZone)) * 100
            ));
            updateStatusDisplay(`Borda: ${percentage}%`, false);
        } else {
            updateStatusDisplay('', false);
        }
    },

    handleRemoteRobotCollision() {
        const remoteRobot = document.getElementById('remote-robot');
        if (!remoteRobot || !remoteRobot.getAttribute('visible')) return;

        const localPos = this.el.object3D.position;
        const remotePos = remoteRobot.object3D.position;

        const dx = localPos.x - remotePos.x;
        const dz = localPos.z - remotePos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < ROBOT_COLLISION_DISTANCE && dist > 0.001) {
            const moveX = localPos.x - this.prevPosition.x;
            const moveZ = localPos.z - this.prevPosition.z;

            const moveDist = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (moveDist > 0.001) {
                const nx = dx / dist;
                const nz = dz / dist;

                const moveDot = -(moveX * nx + moveZ * nz);

                if (moveDot > 0) {
                    Multiplayer.sendPush({ x: moveX, z: moveZ });
                }
            }

            const overlap = ROBOT_COLLISION_DISTANCE - dist;
            const sepX = (dx / dist) * overlap * 0.5;
            const sepZ = (dz / dist) * overlap * 0.5;
            localPos.x += sepX;
            localPos.z += sepZ;
        }

        this.prevPosition.copy(localPos);
    },

    sendStateToRemote() {
        const { position, rotation } = this.el.object3D;

        Multiplayer.sendState(
            { x: position.x, y: position.y, z: position.z },
            { x: rotation.x, y: rotation.y, z: rotation.z }
        );
    },

    checkBoundary() {
        const { position } = this.el.object3D;
        const dist = distanceFromCenter(position.x, position.z);

        if (dist > POSITIONS.boundaryRadius) {
            this.status = GameStatus.FALLING;
            this.fallVelocity = 0;
        }
    },

    updateFalling(dt) {
        const { position, rotation } = this.el.object3D;

        this.fallVelocity += PHYSICS.gravity * dt;
        position.y -= this.fallVelocity * dt;
        rotation.x += PHYSICS.fallRotationSpeed * dt;

        updateStatusDisplay('CAINDO!', true);
    }
});
