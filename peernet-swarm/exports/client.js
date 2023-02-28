import SocketClient from 'socket-request-client';
import '@vandeurenglenn/debug';

class Peer {
    #connection;
    #connected = false;
    #messageQue = [];
    #chunksQue = {};
    #channel;
    #peerId;
    #channelName;
    #chunkSize = 16 * 1024; // 16384
    #queRunning = false;
    #MAX_BUFFERED_AMOUNT = 16 * 1024 * 1024;
    get connection() {
        return this.#connection;
    }
    get connected() {
        return this.#connected;
    }
    get readyState() {
        return this.#channel?.readyState;
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
            switch (this.#channel?.readyState) {
                case 'open':
                    await this.#channel.send(message);
                    if (this.#messageQue.length > 0)
                        return this.#runQue();
                    else
                        this.#queRunning = false;
                    break;
                case 'closed':
                case 'closing':
                    this.#messageQue = [];
                    this.#queRunning = false;
                    debug('channel already closed, this usually means a bad implementation, try checking the readyState or check if the peer is connected before sending');
                    break;
                case undefined:
                    this.#messageQue = [];
                    this.#queRunning = false;
                    debug(`trying to send before a channel is created`);
                    break;
            }
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
            this.#connection = new wrtc.RTCPeerConnection({ iceServers });
            this.#connection.onicecandidate = ({ candidate }) => {
                if (candidate) {
                    this.address = candidate.address;
                    this.port = candidate.port;
                    this.protocol = candidate.protocol;
                    this.ipFamily = this.address.includes('::') ? 'ipv6' : 'ipv4';
                    this._sendMessage({ candidate });
                }
            };
            // if (this.initiator) this.#connection.onnegotiationneeded = () => {
            // console.log('create offer');
            this.#connection.ondatachannel = (message) => {
                message.channel.onopen = () => {
                    this.#connected = true;
                    //  debug(`peer:connected ${this}`)
                    pubsub.publish('peer:connected', this);
                };
                message.channel.onclose = () => this.close.bind(this);
                message.channel.onmessage = (message) => {
                    this._handleMessage(this.id, message);
                };
                this.#channel = message.channel;
            };
            if (this.initiator) {
                this.#channel = this.#connection.createDataChannel('messageChannel');
                this.#channel.onopen = () => {
                    this.#connected = true;
                    pubsub.publish('peer:connected', this);
                    // this.#channel.send('hi')
                };
                this.#channel.onclose = () => this.close.bind(this);
                this.#channel.onmessage = (message) => {
                    this._handleMessage(this.peerId, message);
                };
                const offer = await this.#connection.createOffer();
                await this.#connection.setLocalDescription(offer);
                this._sendMessage({ 'sdp': this.#connection.localDescription });
            }
        }
        catch (e) {
            console.log(e);
        }
        return this;
    }
    _handleMessage(peerId, message) {
        //  debug(`incoming message from ${peerId}`)
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
                channelName: this.options.channelName,
                ...message
            } });
    }
    async _in(message, data) {
        // message = JSON.parse(message);
        if (!this.#connection || message.to !== this.id || message.from !== this.#peerId)
            return;
        // if (data.videocall) return this._startStream(true, false); // start video and audio stream
        // if (data.call) return this._startStream(true, true); // start audio stream
        if (this.#connection?.signalingState === 'stable' && this.#connection?.remoteDescription !== null && this.#connection?.localDescription !== null)
            return;
        if (message.candidate) {
            // debug(`incoming candidate ${this.#channelName}`)
            // debug(message.candidate.candidate)
            this.remoteAddress = message.candidate.address;
            this.remotePort = message.candidate.port;
            this.remoteProtocol = message.candidate.protocol;
            this.remoteIpFamily = this.remoteAddress?.includes('::') ? 'ipv6' : 'ipv4';
            return this.#connection.addIceCandidate(new wrtc.RTCIceCandidate(message.candidate));
        }
        try {
            if (message.sdp) {
                if (this.#connection?.signalingState === 'closed')
                    throw new Error('connection closed');
                if (message.sdp.type === 'offer') {
                    // debug(`incoming offer ${this.#channelName}`)
                    await this.#connection.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp));
                    const answer = await this.#connection.createAnswer();
                    await this.#connection.setLocalDescription(answer);
                    this._sendMessage({ 'sdp': this.#connection.localDescription });
                }
                if (message.sdp.type === 'answer') {
                    // debug(`incoming answer ${this.#channelName}`)
                    await this.#connection.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp));
                }
            }
        }
        catch (e) {
            pubsub.publish('connection closed', this);
            console.log(e);
            this.close();
        }
    }
    close() {
        //  debug(`closing ${this.peerId}`)
        this.#connected = false;
        this.#channel?.close();
        this.#connection?.close();
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
        this.setupListeners();
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
                            // close connection
                            if (this.#connections[id]) {
                                if (this.#connections[id].connected)
                                    await this.#connections[id].close();
                                delete this.#connections[id];
                            }
                            // reconnect
                            if (id !== this.id)
                                this.#connections[id] = await new Peer({ channelName: `${id}:${this.id}`, socketClient: this.socketClient, id: this.id, to: id, peerId: id });
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
