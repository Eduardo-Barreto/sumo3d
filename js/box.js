'use strict';

const BOX_CONFIG = Object.freeze({
    size: 0.20,
    respawnDelayMs: 1500,
    collisionDistance: 0.24,
    spawnMinRadius: 0.25,
    spawnMaxRadius: 0.55
});

AFRAME.registerComponent('pushable-box', {
    schema: {
        target: { type: 'selector', default: '#robot-player' }
    },

    init() {
        this.state = 'idle';
        this.fallVelocity = 0;
        this.baseY = this.el.object3D.position.y;
        this.prevTargetPos = new THREE.Vector3();

        const target = this.data.target;
        if (target) {
            this.prevTargetPos.copy(target.object3D.position);
        }
    },

    tick(_time, timeDelta) {
        if (this.state === 'waiting') return;

        if (this.state === 'falling') {
            this.fall(timeDelta / 1000);
            return;
        }

        this.handleCollision();
        this.checkBoundary();
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
            this.state = 'falling';
            this.fallVelocity = 0;
        }
    },

    fall(dt) {
        const pos = this.el.object3D.position;
        const rot = this.el.object3D.rotation;

        this.fallVelocity += PHYSICS.gravity * dt;
        pos.y -= this.fallVelocity * dt;
        rot.x += 3 * dt;
        rot.z += 2 * dt;

        if (pos.y < POSITIONS.fallThresholdY) {
            this.scheduleRespawn();
        }
    },

    scheduleRespawn() {
        this.state = 'waiting';
        setTimeout(() => this.respawn(), BOX_CONFIG.respawnDelayMs);
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
    }
});
