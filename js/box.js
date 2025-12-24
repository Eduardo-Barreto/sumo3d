'use strict';

const BOX_CONFIG = Object.freeze({
    size: 0.16,
    minRespawnDelayMs: 10,
    maxRespawnDelayMs: 1500,
    collisionDistance: 0.20,
    spawnMinRadius: 0.25,
    spawnMaxRadius: 0.55
});

function getBoxRespawnDelay() {
    const difficulty = Settings.obstacleDifficulty;
    return BOX_CONFIG.maxRespawnDelayMs - (difficulty - 1) * ((BOX_CONFIG.maxRespawnDelayMs - BOX_CONFIG.minRespawnDelayMs) / 9);
}

AFRAME.registerComponent('pushable-box', {
    schema: {
        target: { type: 'selector', default: '#robot-player' }
    },

    init() {
        this.state = 'idle';
        this.fallVelocity = 0;
        this.baseY = this.el.object3D.position.y;
        this.prevTargetPos = new THREE.Vector3();
        this.prevBoxPos = new THREE.Vector3();
        this.fallMomentum = new THREE.Vector3();

        const target = this.data.target;
        if (target) {
            this.prevTargetPos.copy(target.object3D.position);
        }
        this.prevBoxPos.copy(this.el.object3D.position);
    },

    tick(_time, timeDelta) {
        if (Multiplayer.isConnected()) return;
        if (this.state === 'waiting') return;

        if (this.state === 'falling') {
            this.fall(timeDelta / 1000);
            return;
        }

        if (this.state === 'grounded') {
            this.handleCollisionGrounded();
            return;
        }

        const posBefore = this.el.object3D.position.clone();
        this.handleCollision();
        this.checkBoundary();
        this.prevBoxPos.copy(posBefore);
    },

    handleCollision() {
        const target = this.data.target;
        if (!target) return;

        const targetPos = target.object3D.position;
        const boxPos = this.el.object3D.position;

        const dx = boxPos.x - targetPos.x;
        const dz = boxPos.z - targetPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < BOX_CONFIG.collisionDistance) {
            const moveX = targetPos.x - this.prevTargetPos.x;
            const moveZ = targetPos.z - this.prevTargetPos.z;

            boxPos.x += moveX;
            boxPos.z += moveZ;

            const newDx = boxPos.x - targetPos.x;
            const newDz = boxPos.z - targetPos.z;
            const newDist = Math.sqrt(newDx * newDx + newDz * newDz);

            if (newDist < BOX_CONFIG.collisionDistance && newDist > 0.001) {
                const separation = BOX_CONFIG.collisionDistance - newDist;
                boxPos.x += (newDx / newDist) * separation;
                boxPos.z += (newDz / newDist) * separation;
            }
        }

        this.prevTargetPos.copy(targetPos);
    },

    checkBoundary() {
        const pos = this.el.object3D.position;
        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);

        if (distFromCenter > POSITIONS.boundaryRadius) {
            const dx = pos.x - this.prevBoxPos.x;
            const dz = pos.z - this.prevBoxPos.z;
            const momentumScale = 45;
            this.fallMomentum.set(dx * momentumScale, 0, dz * momentumScale);
            this.state = 'falling';
            this.fallVelocity = 0;
        }
    },

    fall(dt) {
        const pos = this.el.object3D.position;
        const rot = this.el.object3D.rotation;

        pos.x += this.fallMomentum.x * dt;
        pos.z += this.fallMomentum.z * dt;

        this.fallVelocity += PHYSICS.gravity * dt;
        pos.y -= this.fallVelocity * dt;
        rot.x += 3 * dt;
        rot.z += 2 * dt;

        const boxLandedY = SAFETY_ZONE.surfaceY + (BOX_CONFIG.size / 2);
        if (pos.y <= boxLandedY) {
            pos.y = boxLandedY;
            rot.x = 0;
            rot.z = 0;
            this.fallVelocity = 0;
            this.fallMomentum.set(0, 0, 0);
            this.groundedY = boxLandedY;
            this.state = 'grounded';
            this.scheduleRespawn();
        }
    },

    handleCollisionGrounded() {
        const target = this.data.target;
        if (!target) return;

        const targetPos = target.object3D.position;
        const boxPos = this.el.object3D.position;

        const dx = boxPos.x - targetPos.x;
        const dz = boxPos.z - targetPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < BOX_CONFIG.collisionDistance && dist > 0.001) {
            const moveX = targetPos.x - this.prevTargetPos.x;
            const moveZ = targetPos.z - this.prevTargetPos.z;

            boxPos.x += moveX;
            boxPos.z += moveZ;
            boxPos.y = this.groundedY;
        }

        this.prevTargetPos.copy(targetPos);
    },

    scheduleRespawn() {
        this.state = 'waiting';
        setTimeout(() => this.respawn(), getBoxRespawnDelay());
    },

    respawn() {
        const safePosition = this.findSafeSpawnPosition();

        this.el.object3D.position.set(safePosition.x, this.baseY, safePosition.z);
        this.el.object3D.rotation.set(0, 0, 0);

        const target = this.data.target;
        if (target) {
            this.prevTargetPos.copy(target.object3D.position);
        }

        this.fallVelocity = 0;
        this.state = 'idle';
    },

    findSafeSpawnPosition() {
        const target = this.data.target;
        const targetPos = target ? target.object3D.position : { x: 0, z: 0 };
        const minSafeDistance = BOX_CONFIG.collisionDistance + 0.15;

        for (let attempts = 0; attempts < 20; attempts++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = BOX_CONFIG.spawnMinRadius + Math.random() * (BOX_CONFIG.spawnMaxRadius - BOX_CONFIG.spawnMinRadius);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const dx = x - targetPos.x;
            const dz = z - targetPos.z;
            const distFromTarget = Math.sqrt(dx * dx + dz * dz);

            if (distFromTarget >= minSafeDistance) {
                return { x, z };
            }
        }

        return { x: 0, z: -0.5 };
    },

    resetToCenter() {
        this.el.object3D.position.set(0, this.baseY, -0.4);
        this.el.object3D.rotation.set(0, 0, 0);
        this.fallVelocity = 0;
        this.state = 'idle';

        const target = this.data.target;
        if (target) {
            this.prevTargetPos.copy(target.object3D.position);
        }
    }
});
