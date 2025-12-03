'use strict';

const REMOTE_ROBOT_CONFIG = Object.freeze({
    lerpFactor: 0.4,
    slerpFactor: 0.4,
    snapDistance: 0.5
});

AFRAME.registerComponent('remote-robot', {
    schema: {
        enabled: { type: 'boolean', default: false }
    },

    init() {
        this.targetPosition = new THREE.Vector3();
        this.targetQuaternion = new THREE.Quaternion();
        this.hasReceivedState = false;

        this.targetPosition.copy(this.el.object3D.position);
        this.targetQuaternion.copy(this.el.object3D.quaternion);

        Multiplayer.onStateReceived = this.onStateReceived.bind(this);
    },

    onStateReceived(state) {
        if (!this.data.enabled) return;

        this.hasReceivedState = true;

        this.targetPosition.set(
            state.position.x,
            state.position.y,
            state.position.z
        );

        const euler = new THREE.Euler(
            state.rotation.x,
            state.rotation.y,
            state.rotation.z,
            'YXZ'
        );
        this.targetQuaternion.setFromEuler(euler);
    },

    tick() {
        if (!this.data.enabled || !this.hasReceivedState) return;

        const dist = this.el.object3D.position.distanceTo(this.targetPosition);

        if (dist > REMOTE_ROBOT_CONFIG.snapDistance) {
            this.el.object3D.position.copy(this.targetPosition);
            this.el.object3D.quaternion.copy(this.targetQuaternion);
        } else {
            this.el.object3D.position.lerp(
                this.targetPosition,
                REMOTE_ROBOT_CONFIG.lerpFactor
            );

            this.el.object3D.quaternion.slerp(
                this.targetQuaternion,
                REMOTE_ROBOT_CONFIG.slerpFactor
            );
        }
    },

    reset() {
        this.hasReceivedState = false;
    }
});
