'use strict';

function applyDeadzone(value, deadzone) {
    if (Math.abs(value) < deadzone) return 0;
    const sign = value > 0 ? 1 : -1;
    return sign * (Math.abs(value) - deadzone) / (1 - deadzone);
}

const InputHandler = {
    keys: {
        forward: false,
        backward: false,
        left: false,
        right: false
    },

    onReset: null,
    boundKeyDown: null,
    boundKeyUp: null,

    init(onResetCallback) {
        this.onReset = onResetCallback;
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);

        window.addEventListener('keydown', this.boundKeyDown);
        window.addEventListener('keyup', this.boundKeyUp);
    },

    cleanup() {
        window.removeEventListener('keydown', this.boundKeyDown);
        window.removeEventListener('keyup', this.boundKeyUp);
    },

    handleKeyDown(event) {
        const { code } = event;

        if (code === KeyCode.ARROW_UP || code === KeyCode.KEY_W) this.keys.forward = true;
        if (code === KeyCode.ARROW_DOWN || code === KeyCode.KEY_S) this.keys.backward = true;
        if (code === KeyCode.ARROW_LEFT || code === KeyCode.KEY_A) this.keys.left = true;
        if (code === KeyCode.ARROW_RIGHT || code === KeyCode.KEY_D) this.keys.right = true;
        if (code === KeyCode.KEY_R && this.onReset) this.onReset();
    },

    handleKeyUp(event) {
        const { code } = event;

        if (code === KeyCode.ARROW_UP || code === KeyCode.KEY_W) this.keys.forward = false;
        if (code === KeyCode.ARROW_DOWN || code === KeyCode.KEY_S) this.keys.backward = false;
        if (code === KeyCode.ARROW_LEFT || code === KeyCode.KEY_A) this.keys.left = false;
        if (code === KeyCode.ARROW_RIGHT || code === KeyCode.KEY_D) this.keys.right = false;
    },

    getInputState() {
        let drive = 0;
        let turn = 0;

        if (this.keys.forward) drive -= 1;
        if (this.keys.backward) drive += 1;
        if (this.keys.left) turn += 1;
        if (this.keys.right) turn -= 1;

        const gamepadInput = this.pollGamepad();
        if (gamepadInput.drive !== 0) drive = gamepadInput.drive;
        if (gamepadInput.turn !== 0) turn = gamepadInput.turn;

        return { drive, turn };
    },

    pollGamepad() {
        if (!navigator.getGamepads) return { drive: 0, turn: 0 };

        try {
            const gamepads = navigator.getGamepads();

            for (const gamepad of gamepads) {
                if (!gamepad) continue;

                const drive = applyDeadzone(gamepad.axes[1] ?? 0, INPUT.gamepadDeadzone);
                const turn = -applyDeadzone(gamepad.axes[0] ?? 0, INPUT.gamepadDeadzone);

                if (drive !== 0 || turn !== 0) return { drive, turn };
            }
        } catch (_error) {
            return { drive: 0, turn: 0 };
        }

        return { drive: 0, turn: 0 };
    }
};
