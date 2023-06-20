var browser$1 = {};

browser$1.MediaStream = window.MediaStream;
browser$1.MediaStreamTrack = window.MediaStreamTrack;
browser$1.RTCDataChannel = window.RTCDataChannel;
browser$1.RTCDataChannelEvent = window.RTCDataChannelEvent;
browser$1.RTCDtlsTransport = window.RTCDtlsTransport;
browser$1.RTCIceCandidate = window.RTCIceCandidate;
browser$1.RTCIceTransport = window.RTCIceTransport;
browser$1.RTCPeerConnection = window.RTCPeerConnection;
browser$1.RTCPeerConnectionIceEvent = window.RTCPeerConnectionIceEvent;
browser$1.RTCRtpReceiver = window.RTCRtpReceiver;
browser$1.RTCRtpSender = window.RTCRtpSender;
browser$1.RTCRtpTransceiver = window.RTCRtpTransceiver;
browser$1.RTCSctpTransport = window.RTCSctpTransport;
browser$1.RTCSessionDescription = window.RTCSessionDescription;
browser$1.getUserMedia = window.getUserMedia;
browser$1.mediaDevices = navigator.mediaDevices;

var browser = /*#__PURE__*/Object.freeze({
	__proto__: null,
	default: browser$1
});

export { browser as b };
