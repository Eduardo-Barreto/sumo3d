'use strict';

const MultiplayerState = Object.freeze({
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    WAITING: 'waiting',
    CONNECTED: 'connected'
});

const MessageType = Object.freeze({
    STATE: 'state',
    FALL: 'fall',
    RESET: 'reset',
    REMATCH: 'rematch',
    PUSH: 'push',
    NICKNAME: 'nickname'
});

const MULTIPLAYER_CONFIG = Object.freeze({
    codeLength: 6,
    codePrefix: 'sumo3d-',
    syncRateMs: 16,
    winScore: 2,
    resetDelayMs: 2000,
    connectionTimeoutMs: 30000
});


const Multiplayer = {
    peer: null,
    connection: null,
    state: MultiplayerState.DISCONNECTED,
    isHost: false,
    roomCode: null,
    score: { local: 0, remote: 0 },
    matchOver: false,
    localNickname: '',
    remoteNickname: '',

    onStateReceived: null,
    onRemoteFall: null,
    onLocalFall: null,
    onConnectionChange: null,
    onScoreChange: null,
    onMatchEnd: null,
    onRemoteReset: null,
    onPushReceived: null,
    onRemoteRematch: null,

    init() {
        const roomCode = this.getRoomFromURL();
        if (roomCode) {
            this.joinRoom(roomCode);
        }
    },

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < MULTIPLAYER_CONFIG.codeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    getRoomFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('room');
    },

    getShareURL() {
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomCode);
        return url.toString();
    },

    createRoom() {
        return new Promise((resolve, reject) => {
            this.roomCode = this.generateRoomCode();
            this.isHost = true;
            this.state = MultiplayerState.CONNECTING;
            this.notifyConnectionChange();

            const peerId = MULTIPLAYER_CONFIG.codePrefix + this.roomCode;

            this.peer = new Peer(peerId);

            this.peer.on('open', () => {
                this.state = MultiplayerState.WAITING;
                this.notifyConnectionChange();
                resolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => {
                this.connection = conn;

                this.connection.on('open', () => {
                    this.state = MultiplayerState.CONNECTED;
                    this.resetScore();
                    this.notifyConnectionChange();
                    this.sendNickname();
                });

                this.connection.on('data', (data) => {
                    this.handleMessage(data);
                });

                this.connection.on('close', () => {
                    this.state = MultiplayerState.DISCONNECTED;
                    this.notifyConnectionChange();
                });

                this.connection.on('error', (err) => {
                    this.handleError(err);
                });
            });

            this.peer.on('error', (err) => {
                this.handleError(err);
                reject(err);
            });
        });
    },

    joinRoom(code) {
        return new Promise((resolve, reject) => {
            this.roomCode = code.toUpperCase();
            this.isHost = false;
            this.state = MultiplayerState.CONNECTING;
            this.notifyConnectionChange();

            this.peer = new Peer();

            const timeout = setTimeout(() => {
                this.handleError(new Error('Connection timeout'));
                reject(new Error('Connection timeout'));
            }, MULTIPLAYER_CONFIG.connectionTimeoutMs);

            this.peer.on('open', () => {
                const hostId = MULTIPLAYER_CONFIG.codePrefix + this.roomCode;
                this.connection = this.peer.connect(hostId, { reliable: true });

                this.connection.on('open', () => {
                    clearTimeout(timeout);
                    this.state = MultiplayerState.CONNECTED;
                    this.resetScore();
                    this.notifyConnectionChange();
                    this.sendNickname();
                    resolve();
                });

                this.connection.on('error', (err) => {
                    clearTimeout(timeout);
                    this.handleError(err);
                    reject(err);
                });

                this.connection.on('close', () => {
                    this.state = MultiplayerState.DISCONNECTED;
                    this.notifyConnectionChange();
                });

                this.connection.on('data', (data) => {
                    this.handleMessage(data);
                });
            });

            this.peer.on('error', (err) => {
                clearTimeout(timeout);
                this.handleError(err);
                reject(err);
            });
        });
    },

    handleMessage(data) {
        switch (data.type) {
            case MessageType.STATE:
                if (this.onStateReceived) {
                    this.onStateReceived(data.payload);
                }
                break;

            case MessageType.FALL:
                this.score.local++;
                this.notifyScoreChange();
                this.checkMatchEnd();
                if (this.onRemoteFall) {
                    this.onRemoteFall();
                }
                break;

            case MessageType.RESET:
                if (this.onRemoteReset) {
                    this.onRemoteReset();
                }
                break;

            case MessageType.REMATCH:
                this.resetScore();
                this.matchOver = false;
                this.notifyScoreChange();
                if (this.onRemoteRematch) {
                    this.onRemoteRematch();
                }
                break;

            case MessageType.PUSH:
                if (this.onPushReceived) {
                    this.onPushReceived(data.payload);
                }
                break;

            case MessageType.NICKNAME:
                this.remoteNickname = data.payload || 'Oponente';
                break;
        }
    },

    sendNickname() {
        if (!this.isConnected()) return;

        this.connection.send({
            type: MessageType.NICKNAME,
            payload: this.localNickname || 'Jogador'
        });
    },

    sendState(position, rotation) {
        if (!this.isConnected()) return;

        this.connection.send({
            type: MessageType.STATE,
            payload: { position, rotation }
        });
    },

    sendPush(push) {
        if (!this.isConnected()) return;

        this.connection.send({
            type: MessageType.PUSH,
            payload: push
        });
    },

    sendFall() {
        if (!this.isConnected()) return;

        this.score.remote++;
        this.notifyScoreChange();
        this.checkMatchEnd();

        if (this.onLocalFall) {
            this.onLocalFall();
        }

        this.connection.send({ type: MessageType.FALL });
    },

    sendReset() {
        if (!this.isConnected()) return;
        this.connection.send({ type: MessageType.RESET });
    },

    sendRematch() {
        if (!this.isConnected()) return;

        this.resetScore();
        this.matchOver = false;
        this.notifyScoreChange();

        this.connection.send({ type: MessageType.REMATCH });
    },

    checkMatchEnd() {
        if (this.matchOver) return;

        if (this.score.local >= MULTIPLAYER_CONFIG.winScore) {
            this.matchOver = true;
            if (this.onMatchEnd) {
                this.onMatchEnd(true);
            }
        } else if (this.score.remote >= MULTIPLAYER_CONFIG.winScore) {
            this.matchOver = true;
            if (this.onMatchEnd) {
                this.onMatchEnd(false);
            }
        }
    },

    resetScore() {
        this.score.local = 0;
        this.score.remote = 0;
    },

    isConnected() {
        return this.state === MultiplayerState.CONNECTED && this.connection;
    },

    isActive() {
        return this.state !== MultiplayerState.DISCONNECTED;
    },

    disconnect() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        this.state = MultiplayerState.DISCONNECTED;
        this.roomCode = null;
        this.isHost = false;
        this.matchOver = false;
        this.localNickname = '';
        this.remoteNickname = '';
        this.resetScore();
        this.notifyConnectionChange();

        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url.toString());
    },

    handleError(err) {
        console.error('Multiplayer error:', err);
        this.state = MultiplayerState.DISCONNECTED;
        this.notifyConnectionChange();
    },

    notifyConnectionChange() {
        if (this.onConnectionChange) {
            this.onConnectionChange(this.state, this.roomCode);
        }
    },

    notifyScoreChange() {
        if (this.onScoreChange) {
            this.onScoreChange(this.score);
        }
    }
};
