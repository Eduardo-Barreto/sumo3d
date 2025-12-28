'use strict';

const LASER_CONFIG = Object.freeze({
    catchDistance: 0.12,
    minSpeedRatio: 0,
    maxSpeedRatio: 1.1,
    spawnMinRadius: 0.15,
    spawnMaxRadius: 0.60,
    directionChangeInterval: 1500,
});

function getLaserSpeed() {
    const difficulty = Settings.obstacleDifficulty;
    const robotSpeed = PHYSICS.moveSpeed * Settings.normalSpeed;
    const speedRatio = LASER_CONFIG.minSpeedRatio + (difficulty - 1) * ((LASER_CONFIG.maxSpeedRatio - LASER_CONFIG.minSpeedRatio) / 9);
    return robotSpeed * speedRatio;
}

AFRAME.registerComponent('laser-chase', {
    schema: {
        target: { type: 'selector', default: '#robot-player' }
    },

    init() {
        this.direction = new THREE.Vector2();
        this.timeSinceDirectionChange = 0;
        this.pickNewDirection();
        this.teleportToRandomPosition();
    },

    tick(_time, timeDelta) {
        if (Multiplayer.isConnected()) return;
        if (!this.el.getAttribute('visible')) return;

        const dt = timeDelta / 1000;

        this.timeSinceDirectionChange += timeDelta;
        if (this.timeSinceDirectionChange >= LASER_CONFIG.directionChangeInterval) {
            this.pickNewDirection();
            this.timeSinceDirectionChange = 0;
        }

        this.move(dt);
        this.checkCatch();
    },

    move(dt) {
        const pos = this.el.object3D.position;
        const speed = getLaserSpeed();

        pos.x += this.direction.x * speed * dt;
        pos.z += this.direction.y * speed * dt;

        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        const maxRadius = LASER_CONFIG.spawnMaxRadius;

        if (distFromCenter > maxRadius) {
            const normalX = pos.x / distFromCenter;
            const normalZ = pos.z / distFromCenter;

            pos.x = normalX * maxRadius;
            pos.z = normalZ * maxRadius;

            const dot = this.direction.x * normalX + this.direction.y * normalZ;
            this.direction.x -= 2 * dot * normalX;
            this.direction.y -= 2 * dot * normalZ;
        }
    },

    checkCatch() {
        const target = this.data.target;
        if (!target) return;

        const targetPos = target.object3D.position;
        const laserPos = this.el.object3D.position;

        const dx = laserPos.x - targetPos.x;
        const dz = laserPos.z - targetPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < LASER_CONFIG.catchDistance) {
            this.teleportToRandomPosition();
        }
    },

    teleportToRandomPosition() {
        const target = this.data.target;
        const targetPos = target ? target.object3D.position : { x: 0, z: 0 };
        const minSafeDistance = LASER_CONFIG.catchDistance + 0.15;

        for (let attempts = 0; attempts < 20; attempts++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = LASER_CONFIG.spawnMinRadius +
                Math.random() * (LASER_CONFIG.spawnMaxRadius - LASER_CONFIG.spawnMinRadius);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const dx = x - targetPos.x;
            const dz = z - targetPos.z;
            const distFromTarget = Math.sqrt(dx * dx + dz * dz);

            if (distFromTarget >= minSafeDistance) {
                this.el.object3D.position.x = x;
                this.el.object3D.position.z = z;
                this.pickNewDirection();
                return;
            }
        }

        this.el.object3D.position.x = 0;
        this.el.object3D.position.z = -0.4;
    },

    pickNewDirection() {
        const angle = Math.random() * Math.PI * 2;
        this.direction.set(Math.cos(angle), Math.sin(angle));
    },

    resetPosition() {
        this.teleportToRandomPosition();
    }
});
