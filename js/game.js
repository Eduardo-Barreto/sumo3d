'use strict';

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

        InputHandler.init(this.resetRobot.bind(this));
        this.resetRobot();
    },

    remove() {
        InputHandler.cleanup();
    },

    resetRobot() {
        const { position, rotation } = this.el.object3D;

        position.set(0, POSITIONS.robotInitialY, 0);
        rotation.set(0, Math.PI, 0);

        this.status = GameStatus.PLAYING;
        this.fallVelocity = 0;

        updateStatusDisplay('', false);
    },

    tick(_time, timeDelta) {
        const { position } = this.el.object3D;

        if (position.y < POSITIONS.fallThresholdY) {
            updateStatusDisplay('Caiu! Pressione R para resetar', true);
            return;
        }

        const dt = timeDelta / 1000;

        if (this.status === GameStatus.FALLING) {
            this.updateFalling(dt);
            return;
        }

        this.updateMovement(dt);
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

        updateStatusDisplay('CAINDO! Pressione R', true);
    }
});
