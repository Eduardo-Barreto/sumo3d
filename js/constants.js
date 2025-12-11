'use strict';

/**
 * All Japan Robot Sumo - Official Specifications
 * @see https://www.fsi.co.jp/sumo/robot/en/rule.html
 */
const SUMO_SPECS = Object.freeze({
    dohyo: {
        radiusM: 0.77,
        heightM: 0.13
    },
    robot: {
        widthM: 0.20,
        depthM: 0.20,
        heightM: 0.08
    }
});

const PHYSICS = Object.freeze({
    moveSpeed: 2.2,
    rotationSpeed: 10.0,
    gravity: 9.8,
    fallRotationSpeed: 2.0,
    boundaryMarginM: 0.01
});

const INPUT = Object.freeze({
    gamepadDeadzone: 0.15
});

const POSITIONS = Object.freeze({
    robotInitialY: SUMO_SPECS.dohyo.heightM + (SUMO_SPECS.robot.heightM / 2),
    fallThresholdY: -2,
    boundaryRadius: SUMO_SPECS.dohyo.radiusM + PHYSICS.boundaryMarginM
});

const GameStatus = Object.freeze({
    PLAYING: 'playing',
    FALLING: 'falling'
});

const KeyCode = Object.freeze({
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    KEY_W: 'KeyW',
    KEY_A: 'KeyA',
    KEY_S: 'KeyS',
    KEY_D: 'KeyD',
    KEY_R: 'KeyR',
    KEY_V: 'KeyV',
    KEY_J: 'KeyJ'
});

const Settings = {
    normalSpeed: 1.5,
    slowSpeed: 0.3
};
