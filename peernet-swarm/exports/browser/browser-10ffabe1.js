function _mergeNamespaces(n, m) {
	m.forEach(function (e) {
		e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
			if (k !== 'default' && !(k in n)) {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	});
	return Object.freeze(n);
}

var browser$1 = {};

var MediaStream = browser$1.MediaStream = window.MediaStream;
var MediaStreamTrack = browser$1.MediaStreamTrack = window.MediaStreamTrack;
var RTCDataChannel = browser$1.RTCDataChannel = window.RTCDataChannel;
var RTCDataChannelEvent = browser$1.RTCDataChannelEvent = window.RTCDataChannelEvent;
var RTCDtlsTransport = browser$1.RTCDtlsTransport = window.RTCDtlsTransport;
var RTCIceCandidate = browser$1.RTCIceCandidate = window.RTCIceCandidate;
var RTCIceTransport = browser$1.RTCIceTransport = window.RTCIceTransport;
var RTCPeerConnection = browser$1.RTCPeerConnection = window.RTCPeerConnection;
var RTCPeerConnectionIceEvent = browser$1.RTCPeerConnectionIceEvent = window.RTCPeerConnectionIceEvent;
var RTCRtpReceiver = browser$1.RTCRtpReceiver = window.RTCRtpReceiver;
var RTCRtpSender = browser$1.RTCRtpSender = window.RTCRtpSender;
var RTCRtpTransceiver = browser$1.RTCRtpTransceiver = window.RTCRtpTransceiver;
var RTCSctpTransport = browser$1.RTCSctpTransport = window.RTCSctpTransport;
var RTCSessionDescription = browser$1.RTCSessionDescription = window.RTCSessionDescription;
var getUserMedia = browser$1.getUserMedia = window.getUserMedia;
var mediaDevices = browser$1.mediaDevices = navigator.mediaDevices;

var browser = /*#__PURE__*/_mergeNamespaces({
	__proto__: null,
	MediaStream: MediaStream,
	MediaStreamTrack: MediaStreamTrack,
	RTCDataChannel: RTCDataChannel,
	RTCDataChannelEvent: RTCDataChannelEvent,
	RTCDtlsTransport: RTCDtlsTransport,
	RTCIceCandidate: RTCIceCandidate,
	RTCIceTransport: RTCIceTransport,
	RTCPeerConnection: RTCPeerConnection,
	RTCPeerConnectionIceEvent: RTCPeerConnectionIceEvent,
	RTCRtpReceiver: RTCRtpReceiver,
	RTCRtpSender: RTCRtpSender,
	RTCRtpTransceiver: RTCRtpTransceiver,
	RTCSctpTransport: RTCSctpTransport,
	RTCSessionDescription: RTCSessionDescription,
	default: browser$1,
	getUserMedia: getUserMedia,
	mediaDevices: mediaDevices
}, [browser$1]);

export { browser as b };
