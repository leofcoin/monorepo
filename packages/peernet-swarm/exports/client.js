import SocketClient from 'socket-request-client';
import '@vandeurenglenn/debug';
import SimplePeer from '@vandeurenglenn/simple-peer';

class Peer {
    #connection;
    #connected = false;
    #messageQue = [];
    #chunksQue = {};
    #channel;
    id;
    #peerId;
    #channelName;
    #chunkSize = 16 * 1024; // 16384
    #queRunning = false;
    #MAX_BUFFERED_AMOUNT = 16 * 1024 * 1024;
    initiator = false;
    state;
    #makingOffer = false;
    get connection() {
        return this.#connection;
    }
    get connected() {
        return this.#connected;
    }
    get readyState() {
        return this.#channel?.readyState;
    }
    get channelName() {
        return this.#channelName;
    }
    /**
     * @params {Object} options
     * @params {string} options.channelName - this peerid : otherpeer id
    */
    constructor(options = {}) {
        this._in = this._in.bind(this);
        this.offerOptions = options.offerOptions;
        this.initiator = options.initiator;
        this.streams = options.streams;
        this.socketClient = options.socketClient;
        this.id = options.id;
        this.to = options.to;
        this.bw = {
            up: 0,
            down: 0
        };
        this.#channelName = options.channelName;
        this.#peerId = options.peerId;
        this.options = options;
        return this.#init();
    }
    get peerId() {
        return this.#peerId;
    }
    set socketClient(value) {
        // this.socketClient?.pubsub.unsubscribe('signal', this._in)
        this._socketClient = value;
        this._socketClient.pubsub.subscribe('signal', this._in);
    }
    get socketClient() {
        return this._socketClient;
    }
    splitMessage(message) {
        const chunks = [];
        message = pako.deflate(message);
        const size = message.byteLength || message.length;
        let offset = 0;
        return new Promise((resolve, reject) => {
            const splitMessage = () => {
                const chunk = message.slice(offset, offset + this.#chunkSize > size ? size : offset + this.#chunkSize);
                offset += this.#chunkSize;
                chunks.push(chunk);
                if (offset < size)
                    return splitMessage();
                else
                    resolve({ chunks, size });
            };
            splitMessage();
        });
    }
    async #runQue() {
        this.#queRunning = true;
        if (this.#messageQue.length > 0 && this.#channel?.bufferedAmount + this.#messageQue[0]?.length < this.#MAX_BUFFERED_AMOUNT) {
            const message = this.#messageQue.shift();
            await this.#connection.send(message);
            if (this.#messageQue.length > 0)
                return this.#runQue();
            // switch (this.#channel?.readyState) {
            //   case 'open':
            //   await this.#channel.send(message);
            //   if (this.#messageQue.length > 0) return this.#runQue()
            //   else this.#queRunning = false
            //   break;
            //   case 'closed':
            //   case 'closing':
            //   this.#messageQue = []
            //   this.#queRunning = false
            //   debug('channel already closed, this usually means a bad implementation, try checking the readyState or check if the peer is connected before sending');
            //   break;
            //   case undefined:
            //   this.#messageQue = []
            //   this.#queRunning = false
            //   debug(`trying to send before a channel is created`);
            //   break;
            // }
        }
        else {
            return setTimeout(() => this.#runQue(), 50);
        }
    }
    #trySend({ size, id, chunks }) {
        let offset = 0;
        for (const chunk of chunks) {
            const start = offset;
            const end = offset + chunk.length;
            const message = new TextEncoder().encode(JSON.stringify({ size, id, chunk, start, end }));
            this.#messageQue.push(message);
        }
        if (!this.queRunning)
            return this.#runQue();
    }
    async send(message, id) {
        const { chunks, size } = await this.splitMessage(message);
        return this.#trySend({ size, id, chunks });
    }
    request(data) {
        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).slice(-12);
            const _onData = message => {
                if (message.id === id) {
                    resolve(message.data);
                    pubsub.unsubscribe(`peer:data`, _onData);
                }
            };
            pubsub.subscribe(`peer:data`, _onData);
            // cleanup subscriptions
            // setTimeout(() => {
            //   pubsub.unsubscribe(`peer:data-request-${id}`, _onData)
            // }, 5000);
            this.send(data, id);
        });
    }
    async #init() {
        try {
            if (!globalThis.pako) {
                const importee = await import('pako');
                globalThis.pako = importee.default;
            }
            const iceServers = [{
                    urls: 'stun:stun.l.google.com:19302' // Google's public STUN server
                }, {
                    urls: "stun:openrelay.metered.ca:80",
                }, {
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                }, {
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                }];
            this.#connection = new SimplePeer({
                channelName: this.channelName,
                initiator: this.initiator,
                peerId: this.peerId,
                wrtc: globalThis.wrtc,
                config: {
                    iceServers
                }
            });
            this.#connection.on('signal', signal => {
                this._sendMessage({ signal });
            });
            this.#connection.on('connect', () => {
                this.#connected = true;
                pubsub.publish('peer:connected', this);
            });
            this.#connection.on('close', () => {
                this.close();
            });
            this.#connection.on('data', data => {
                this._handleMessage(data);
            });
            this.#connection.on('error', (e) => {
                pubsub.publish('connection closed', this);
                console.log(e);
                this.close();
            });
        }
        catch (e) {
            console.log(e);
        }
        return this;
    }
    _handleMessage(message) {
        console.log({ message });
        message = JSON.parse(new TextDecoder().decode(message.data));
        // allow sharding (multiple peers share data)
        pubsub.publish('peernet:shard', message);
        const { id } = message;
        if (!this.#chunksQue[id])
            this.#chunksQue[id] = [];
        if (message.size > this.#chunksQue[id].length || message.size === this.#chunksQue[id].length) {
            for (const value of Object.values(message.chunk)) {
                this.#chunksQue[id].push(value);
            }
        }
        if (message.size === this.#chunksQue[id].length) {
            let data = new Uint8Array(Object.values(this.#chunksQue[id]));
            delete this.#chunksQue[id];
            data = pako.inflate(data);
            pubsub.publish('peer:data', { id, data, from: this.peerId });
        }
        this.bw.down += message.byteLength || message.length;
    }
    _sendMessage(message) {
        this.socketClient.send({ url: 'signal', params: {
                to: this.to,
                from: this.id,
                channelName: this.channelName,
                ...message
            } });
    }
    async _in(message, data) {
        if (message.signal)
            return this.#connection.signal(message.signal);
    }
    close() {
        //  debug(`closing ${this.peerId}`)
        this.#connected = false;
        // this.#channel?.close()
        // this.#connection?.exit()
        this.socketClient.pubsub.unsubscribe('signal', this._in);
    }
}

class Client {
    #peerConnection;
    #connections = {};
    #stars = {};
    id;
    networkVersion;
    starsConfig;
    socketClient;
    get connections() {
        return { ...this.#connections };
    }
    get peers() {
        return Object.entries(this.#connections);
    }
    constructor(id, networkVersion = 'peach', stars = ['wss://peach.leofcoin.org']) {
        this.id = id || Math.random().toString(36).slice(-12);
        this.peerJoined = this.peerJoined.bind(this);
        this.peerLeft = this.peerLeft.bind(this);
        this.starLeft = this.starLeft.bind(this);
        this.starJoined = this.starJoined.bind(this);
        this.networkVersion = networkVersion;
        this._init(stars);
    }
    async _init(stars = []) {
        this.starsConfig = stars;
        // reconnectJob()
        if (!globalThis.RTCPeerConnection)
            globalThis.wrtc = (await import('@koush/wrtc')).default;
        else
            globalThis.wrtc = {
                RTCPeerConnection,
                RTCSessionDescription,
                RTCIceCandidate
            };
        for (const star of stars) {
            try {
                this.socketClient = await SocketClient(star, this.networkVersion);
                const id = await this.socketClient.request({ url: 'id', params: { from: this.id } });
                this.socketClient.peerId = id;
                this.#stars[id] = this.socketClient;
            }
            catch (e) {
                if (stars.indexOf(star) === stars.length - 1 && !this.socketClient)
                    throw new Error(`No star available to connect`);
            }
        }
        this.setupListeners();
        const peers = await this.socketClient.peernet.join({ id: this.id });
        for (const id of peers) {
            if (id !== this.id && !this.#connections[id])
                this.#connections[id] = await new Peer({ channelName: `${id}:${this.id}`, socketClient: this.socketClient, id: this.id, to: id, peerId: id });
        }
        pubsub.subscribe('connection closed', (peer) => {
            this.removePeer(peer.peerId);
            setTimeout(() => {
                this.peerJoined(peer.peerId);
            }, 1000);
        });
    }
    setupListeners() {
        this.socketClient.subscribe('peer:joined', this.peerJoined);
        this.socketClient.subscribe('peer:left', this.peerLeft);
        this.socketClient.subscribe('star:left', this.starLeft);
    }
    starJoined(id) {
        if (this.#stars[id]) {
            this.#stars[id].close();
            delete this.#stars[id];
        }
        console.log(`star ${id} joined`);
    }
    async starLeft(id) {
        if (this.#stars[id]) {
            this.#stars[id].close();
            delete this.#stars[id];
        }
        if (this.socketClient?.peerId === id) {
            this.socketClient.unsubscribe('peer:joined', this.peerJoined);
            this.socketClient.unsubscribe('peer:left', this.peerLeft);
            this.socketClient.unsubscribe('star:left', this.starLeft);
            this.socketClient.close();
            this.socketClient = undefined;
            for (const star of this.starsConfig) {
                try {
                    this.socketClient = await SocketClient(star, this.networkVersion);
                    if (!this.socketClient?.client?._connection.connected)
                        return;
                    const id = await this.socketClient.request({ url: 'id', params: { from: this.id } });
                    this.#stars[id] = this.socketClient;
                    this.socketClient.peerId = id;
                    const peers = await this.socketClient.peernet.join({ id: this.id });
                    this.setupListeners();
                    for (const id of peers) {
                        if (id !== this.id) {
                            if (!this.#connections[id]) {
                                if (id !== this.id)
                                    this.#connections[id] = await new Peer({ channelName: `${id}:${this.id}`, socketClient: this.socketClient, id: this.id, to: id, peerId: id });
                            }
                        }
                    }
                }
                catch (e) {
                    console.log(e);
                    if (this.starsConfig.indexOf(star) === this.starsConfig.length - 1 && !this.socketClient)
                        throw new Error(`No star available to connect`);
                }
            }
        }
        globalThis.debug(`star ${id} left`);
    }
    peerLeft(peer) {
        const id = peer.peerId || peer;
        if (this.#connections[id]) {
            this.#connections[id].close();
            delete this.#connections[id];
        }
        globalThis.debug(`peer ${id} left`);
    }
    async peerJoined(peer, signal) {
        const id = peer.peerId || peer;
        if (this.#connections[id]) {
            if (this.#connections[id].connected)
                this.#connections[id].close();
            delete this.#connections[id];
        }
        // RTCPeerConnection
        this.#connections[id] = await new Peer({ initiator: true, channelName: `${this.id}:${id}`, socketClient: this.socketClient, id: this.id, to: id, peerId: id });
        globalThis.debug(`peer ${id} joined`);
    }
    removePeer(peer) {
        const id = peer.peerId || peer;
        if (this.#connections[id]) {
            this.#connections[id].connected && this.#connections[id].close();
            delete this.#connections[id];
        }
        globalThis.debug(`peer ${id} removed`);
    }
    async close() {
        this.socketClient.unsubscribe('peer:joined', this.peerJoined);
        this.socketClient.unsubscribe('peer:left', this.peerLeft);
        this.socketClient.unsubscribe('star:left', this.starLeft);
        const promises = [
            Object.values(this.#connections).map(connection => connection.close()),
            Object.values(this.#stars).map(connection => connection.close()),
            this.socketClient.close()
        ];
        return Promise.allSettled(promises);
    }
}

export { Client as default };
