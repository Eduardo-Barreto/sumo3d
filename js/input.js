'use strict';

function applyDeadzone(value, deadzone) {
    if (Math.abs(value) < deadzone) return 0;
    const sign = value > 0 ? 1 : -1;
    return sign * (Math.abs(value) - deadzone) / (1 - deadzone);
}

const JOYSTICK_STICK_RADIUS = 25; // Half of the joystick stick size (50px / 2)

const InputHandler = {
    keys: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        leftForward: false,
        leftBackward: false,
        rightForward: false,
        rightBackward: false
    },

    joysticks: {
        left: { x: 0, y: 0, active: false },
        right: { x: 0, y: 0, active: false }
    },

    vrThumbsticks: {
        left: { x: 0, y: 0 },
        right: { x: 0, y: 0 }
    },

    onReset: null,
    onToggleFPV: null,
    onToggleJoysticks: null,
    boundKeyDown: null,
    boundKeyUp: null,

    init(onResetCallback, onToggleFPVCallback, onToggleJoysticksCallback) {
        this.onReset = onResetCallback;
        this.onToggleFPV = onToggleFPVCallback;
        this.onToggleJoysticks = onToggleJoysticksCallback;
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);

        window.addEventListener('keydown', this.boundKeyDown);
        window.addEventListener('keyup', this.boundKeyUp);
        
        this.initJoysticks();
    },

    cleanup() {
        window.removeEventListener('keydown', this.boundKeyDown);
        window.removeEventListener('keyup', this.boundKeyUp);
        this.cleanupJoysticks();
    },

    initJoysticks() {
        const leftJoystick = document.getElementById('joystick-left');
        const rightJoystick = document.getElementById('joystick-right');

        if (leftJoystick) {
            this.setupJoystick(leftJoystick, 'left');
        }
        if (rightJoystick) {
            this.setupJoystick(rightJoystick, 'right');
        }
    },

    setupJoystick(element, side) {
        const base = element.querySelector('.joystick-base');
        const stick = element.querySelector('.joystick-stick');
        let touchId = null;
        let isTouch = false;

        const handleStart = (e) => {
            e.preventDefault();
            isTouch = e.type.includes('touch');
            const touch = isTouch ? e.changedTouches[0] : e;
            touchId = isTouch ? touch.identifier : null;
            element.classList.add('active');
            this.joysticks[side].active = true;
            this.updateJoystick(touch, base, stick, side);
        };

        const handleMove = (e) => {
            if (!this.joysticks[side].active) return;
            e.preventDefault();
            
            let touch = e;
            if (isTouch && e.type.includes('touch')) {
                // Find the touch that matches our stored identifier
                touch = null;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === touchId) {
                        touch = e.changedTouches[i];
                        break;
                    }
                }
                if (!touch) return; // Touch not found, ignore this event
            }
            
            this.updateJoystick(touch, base, stick, side);
        };

        const handleEnd = (e) => {
            if (!this.joysticks[side].active) return;
            e.preventDefault();
            touchId = null;
            isTouch = false;
            element.classList.remove('active');
            this.joysticks[side] = { x: 0, y: 0, active: false };
            stick.style.transform = 'translate(-50%, -50%)';
        };

        if (base) {
            base.addEventListener('touchstart', handleStart, { passive: false });
            base.addEventListener('mousedown', handleStart);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('touchend', handleEnd, { passive: false });
            window.addEventListener('mouseup', handleEnd);

            // Store references for cleanup
            element._handlers = { handleStart, handleMove, handleEnd, base };
        }
    },

    updateJoystick(touch, base, stick, side) {
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = touch.clientX - centerX;
        const deltaY = touch.clientY - centerY;

        const maxDistance = rect.width / 2 - JOYSTICK_STICK_RADIUS;
        const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
        const angle = Math.atan2(deltaY, deltaX);

        const x = distance * Math.cos(angle);
        const y = distance * Math.sin(angle);

        stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        // Normalize values to -1 to 1
        // Y coordinate matches screen coordinates: positive = down/backward, negative = up/forward
        this.joysticks[side].x = x / maxDistance;
        this.joysticks[side].y = y / maxDistance;
    },

    cleanupJoysticks() {
        const leftJoystick = document.getElementById('joystick-left');
        const rightJoystick = document.getElementById('joystick-right');

        [leftJoystick, rightJoystick].forEach(element => {
            if (element && element._handlers) {
                const { handleStart, handleMove, handleEnd, base } = element._handlers;
                
                if (base) {
                    base.removeEventListener('touchstart', handleStart, { passive: false });
                    base.removeEventListener('mousedown', handleStart);
                    window.removeEventListener('touchmove', handleMove, { passive: false });
                    window.removeEventListener('mousemove', handleMove);
                    window.removeEventListener('touchend', handleEnd, { passive: false });
                    window.removeEventListener('mouseup', handleEnd);
                }
                
                // Clear the handlers reference to prevent memory leaks
                delete element._handlers;
            }
        });
    },

    handleKeyDown(event) {
        const { code } = event;

        if (code === KeyCode.ARROW_UP || code === KeyCode.KEY_W) this.keys.forward = true;
        if (code === KeyCode.ARROW_DOWN || code === KeyCode.KEY_S) this.keys.backward = true;
        if (code === KeyCode.ARROW_LEFT) this.keys.left = true;
        if (code === KeyCode.ARROW_RIGHT || code === KeyCode.KEY_D) this.keys.right = true;
        if (code === KeyCode.KEY_A) this.keys.leftForward = true;
        if (code === KeyCode.KEY_Z) this.keys.leftBackward = true;
        if (code === KeyCode.KEY_G) this.keys.rightForward = true;
        if (code === KeyCode.KEY_B) this.keys.rightBackward = true;
        if (code === KeyCode.KEY_R && this.onReset && !Multiplayer.isConnected()) this.onReset();
        if (code === KeyCode.KEY_V && this.onToggleFPV) this.onToggleFPV();
        if (code === KeyCode.KEY_J && this.onToggleJoysticks) this.onToggleJoysticks();
    },

    handleKeyUp(event) {
        const { code } = event;

        if (code === KeyCode.ARROW_UP || code === KeyCode.KEY_W) this.keys.forward = false;
        if (code === KeyCode.ARROW_DOWN || code === KeyCode.KEY_S) this.keys.backward = false;
        if (code === KeyCode.ARROW_LEFT) this.keys.left = false;
        if (code === KeyCode.ARROW_RIGHT || code === KeyCode.KEY_D) this.keys.right = false;
        if (code === KeyCode.KEY_A) this.keys.leftForward = false;
        if (code === KeyCode.KEY_Z) this.keys.leftBackward = false;
        if (code === KeyCode.KEY_G) this.keys.rightForward = false;
        if (code === KeyCode.KEY_B) this.keys.rightBackward = false;
    },

    updateVRThumbstick(hand, x, y) {
        this.vrThumbsticks[hand] = { x, y };
    },

    getInputState() {
        const gamepadInput = this.pollGamepad();
        if (gamepadInput.useTankControls) return gamepadInput;

        const vrLeft = this.vrThumbsticks.left;
        const vrRight = this.vrThumbsticks.right;
        if (Math.abs(vrLeft.y) > INPUT.gamepadDeadzone || Math.abs(vrRight.y) > INPUT.gamepadDeadzone) {
            return {
                leftWheel: this.discretize(-vrLeft.y),
                rightWheel: this.discretize(-vrRight.y),
                useTankControls: true
            };
        }

        if (this.joysticks.left.active || this.joysticks.right.active) {
            return {
                leftWheel: this.joysticks.right.y,
                rightWheel: this.joysticks.left.y,
                useTankControls: true
            };
        }

        const tankKeysActive = this.keys.leftForward || this.keys.leftBackward ||
                               this.keys.rightForward || this.keys.rightBackward;
        if (tankKeysActive) {
            let leftWheel = 0;
            let rightWheel = 0;
            if (this.keys.leftForward) rightWheel -= 1;
            if (this.keys.leftBackward) rightWheel += 1;
            if (this.keys.rightForward) leftWheel -= 1;
            if (this.keys.rightBackward) leftWheel += 1;
            return { leftWheel, rightWheel, useTankControls: true };
        }

        let drive = 0;
        let turn = 0;
        if (this.keys.forward) drive -= 1;
        if (this.keys.backward) drive += 1;
        if (this.keys.left) turn += 1;
        if (this.keys.right) turn -= 1;

        return { drive, turn, useTankControls: false };
    },

    pollGamepadButtons() {
        if (!navigator.getGamepads) return;

        try {
            const gamepads = navigator.getGamepads();
            for (const gamepad of gamepads) {
                if (!gamepad) continue;
                const aPressed = gamepad.buttons[0]?.pressed;
                if (aPressed && !this._aButtonWasPressed && this.onReset && !Multiplayer.isConnected()) {
                    this.onReset();
                }
                this._aButtonWasPressed = aPressed;
                return;
            }
        } catch (_error) {}
    },

    pollGamepad() {
        if (!navigator.getGamepads) return { useTankControls: false };

        try {
            const gamepads = navigator.getGamepads();
            for (const gamepad of gamepads) {
                if (!gamepad) continue;

                const leftRaw = gamepad.axes[3] ?? 0;
                const rightRaw = gamepad.axes[1] ?? 0;
                const triggerPressed = (gamepad.buttons[6]?.value > 0.5) || (gamepad.buttons[7]?.value > 0.5);

                const leftWheel = this.discretize(leftRaw);
                const rightWheel = this.discretize(rightRaw);

                if (leftWheel !== 0 || rightWheel !== 0) {
                    return { leftWheel, rightWheel, triggerPressed, useTankControls: true };
                }
            }
        } catch (_error) {
            return { useTankControls: false };
        }

        return { useTankControls: false };
    },

    discretize(value) {
        if (Math.abs(value) < INPUT.gamepadDeadzone) return 0;
        return value > 0 ? 1 : -1;
    }
};

AFRAME.registerComponent('xr-input-monitor', {
    init() {
        this.el.sceneEl.addEventListener('enter-vr', () => { this.inVR = true; });
        this.el.sceneEl.addEventListener('exit-vr', () => { this.inVR = false; });
        this.inVR = false;
        this._aButtonWasPressed = false;
    },

    tick() {
        if (!this.inVR) return;

        const xrSession = this.el.sceneEl.renderer?.xr?.getSession?.();
        if (!xrSession) return;

        for (const source of xrSession.inputSources) {
            const gamepad = source.gamepad;
            if (!gamepad) continue;

            const hand = source.handedness;
            const thumbstickX = gamepad.axes[2] ?? 0;
            const thumbstickY = gamepad.axes[3] ?? 0;

            if (hand === 'left') {
                InputHandler.updateVRThumbstick('right', thumbstickX, -thumbstickY);
            } else if (hand === 'right') {
                InputHandler.updateVRThumbstick('left', thumbstickX, -thumbstickY);

                const aPressed = gamepad.buttons[4]?.pressed;
                if (aPressed && !this._aButtonWasPressed && InputHandler.onReset && !Multiplayer.isConnected()) {
                    InputHandler.onReset();
                }
                this._aButtonWasPressed = aPressed;
            }
        }
    }
});
