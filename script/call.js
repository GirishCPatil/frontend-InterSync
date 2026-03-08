const BASE_URL = 'https://intersync.onrender.com';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// Call details
const targetUserId = localStorage.getItem('callTargetId');
const isInitiator = localStorage.getItem('isInitiator') === 'true';

// Element DOMs
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const localPlaceholder = document.getElementById('localPlaceholder');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const callStatusText = document.getElementById('callStatusText');
const connectionDot = document.getElementById('connectionDot');
const statusOverlay = document.getElementById('statusOverlay');
const overlayText = document.getElementById('overlayText');
const callTimer = document.getElementById('callTimer');
const ratingOverlay = document.getElementById('ratingOverlay');
const starContainer = document.getElementById('starContainer');
const submitRatingBtn = document.getElementById('submitRatingBtn');
const skipRatingBtn = document.getElementById('skipRatingBtn');

if (!token || !targetUserId) {
    window.location.href = './dashboard.html';
}

// Socket + Peer setup
const socket = io(BASE_URL);
let peer = null;
let currentStream = null;
let timerInterval = null;
let seconds = 0;

socket.on('connect', () => {
    // 1. Register with Socket
    socket.emit('register_online', {
        userId: user._id,
        userName: user.name
    });

    // 2. Start Camera
    startCallSetup();
});

async function startCallSetup() {
    try {
        // Get media stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        currentStream = stream;
        localVideo.srcObject = stream;
        localPlaceholder.style.display = 'none';

        // 3. Initialize PeerConnection
        initPeer(stream);

    } catch (err) {
        console.error('Failed to get media devices:', err);
        overlayText.textContent = "Error accessing camera/mic";
        setTimeout(() => window.location.href = './dashboard.html', 3000);
    }
}

function initPeer(stream) {
    // We use SimplePeer library imported in HTML
    peer = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        stream: stream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    // Signaling event - we generated an offer/answer or ICE candidate
    peer.on('signal', data => {
        // If initiator, this is the very first offer. 
        // We trigger the actual ring on the other person.
        if (isInitiator && data.type === 'offer') {
            socket.emit('request_call', {
                targetUserId: targetUserId,
                callerName: user.name,
                callerId: user._id,
                signalData: data
            });
            overlayText.textContent = "Calling peer...";
        } else {
            // Standard signaling exchange (answers, ice candidates)
            socket.emit('webrtc_signal', {
                targetUserId: targetUserId,
                signal: data
            });
        }
    });

    // Remote stream received
    peer.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        remotePlaceholder.style.display = 'none';
    });

    // Connection established
    peer.on('connect', () => {
        statusOverlay.classList.add('hidden');
        connectionDot.classList.add('connected');
        callStatusText.textContent = 'Connected in Call';
        startTimer();
    });

    peer.on('close', () => endCallCleanly());
    peer.on('error', err => console.log('Peer error:', err));

    // If we are NOT the initiator, we should already have an offer stored in localStorage
    if (!isInitiator) {
        const incomingSignalStr = localStorage.getItem('incomingSignal');
        if (incomingSignalStr) {
            const offer = JSON.parse(incomingSignalStr);
            console.log('Accepting incoming offer');
            peer.signal(offer);
            localStorage.removeItem('incomingSignal');

            // Tell backend we accepted, so it links the active call
            socket.emit('accept_call', {
                callerId: targetUserId,
                receiverId: user._id,
                signalData: null // We send our answer via the 'signal' event above
            });
            overlayText.textContent = "Connecting to call...";
        }
    }
}

// ── Socket Events ──

socket.on('call_accepted', (data) => {
    // The receiver accepted and sent an answer via signal stream later
    overlayText.textContent = "Peer accepted. Connecting media...";
});

socket.on('call_rejected', () => {
    overlayText.textContent = "Call Declined";
    setTimeout(() => window.location.href = './dashboard.html', 1500);
});

// Receive signaling data (Answer or ICE)
socket.on('webrtc_signal', (data) => {
    if (data.senderId === targetUserId && peer) {
        peer.signal(data.signal);
    }
});

// Call ended remotely
socket.on('call_ended', () => {
    endCallCleanly(true);
});


// ── Call Controls ──

let micEnabled = true;
document.getElementById('toggleMicBtn').addEventListener('click', (e) => {
    micEnabled = !micEnabled;
    const audioTrack = currentStream.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = micEnabled;

    e.target.textContent = micEnabled ? '🎤' : '🔇';
    if (!micEnabled) e.target.classList.add('active');
    else e.target.classList.remove('active');
});

let camEnabled = true;
document.getElementById('toggleCamBtn').addEventListener('click', (e) => {
    camEnabled = !camEnabled;
    const videoTrack = currentStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = camEnabled;

    e.target.textContent = camEnabled ? '📹' : '📵';
    localPlaceholder.style.display = camEnabled ? 'none' : 'flex';

    if (!camEnabled) e.target.classList.add('active');
    else e.target.classList.remove('active');
});

// ── Screen Sharing ──
let isScreenSharing = false;
let screenStream = null;
const toggleScreenBtn = document.getElementById('toggleScreenBtn');

toggleScreenBtn.addEventListener('click', async (e) => {
    if (!peer) return;

    if (!isScreenSharing) {
        try {
            // Request screen share stream
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            // Revert back when user clicks native "Stop sharing" button
            screenTrack.onended = () => {
                stopScreenShare();
            };

            // Replace current video track in peer connection
            const currentVideoTrack = currentStream.getVideoTracks()[0];
            peer.replaceTrack(currentVideoTrack, screenTrack, currentStream);

            // Show screen in local video element
            localVideo.srcObject = screenStream;

            isScreenSharing = true;
            toggleScreenBtn.classList.add('active');
            toggleScreenBtn.textContent = '⏹️'; // Change icon to indicate stop

        } catch (err) {
            console.error('Failed to get screen sharing stream', err);
        }
    } else {
        stopScreenShare();
    }
});

function stopScreenShare() {
    if (!isScreenSharing) return;

    // Replace screen track back with original camera track
    const currentVideoTrack = currentStream.getVideoTracks()[0];
    const screenTrack = screenStream.getVideoTracks()[0];

    // Stop the screen share track safely
    screenTrack.stop();

    // Replace track back to camera stream if camera is enabled
    // Note: Use currentStream's track even if camEnabled is false so peer connection state is correct
    peer.replaceTrack(screenTrack, currentVideoTrack, currentStream);

    // Swap local video back to camera stream
    localVideo.srcObject = currentStream;

    isScreenSharing = false;
    toggleScreenBtn.classList.remove('active');
    toggleScreenBtn.textContent = '💻'; // Revert back to screen icon
    screenStream = null;
}

document.getElementById('endCallBtn').addEventListener('click', () => {
    socket.emit('end_call', { targetUserId });
    endCallCleanly(false);
});

function endCallCleanly(remoteEnded = false) {
    if (peer) peer.destroy();
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
    clearInterval(timerInterval);

    // Hide active UI and show rating modal
    document.querySelector('.video-container').style.display = 'none';
    document.querySelector('.controls-bar').style.display = 'none';
    statusOverlay.classList.add('hidden');

    ratingOverlay.classList.remove('hidden');
    ratingOverlay.classList.add('show');
}

// ── Rating Logic ──
let selectedRating = 0;

if (starContainer) {
    const stars = Array.from(starContainer.querySelectorAll('.star'));

    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            selectedRating = parseInt(e.target.dataset.value);

            // Clear all
            stars.forEach(s => s.classList.remove('selected'));

            // Highlight selected and below (remember they are structurally reversed in HTML)
            stars.forEach(s => {
                if (parseInt(s.dataset.value) <= selectedRating) {
                    s.classList.add('selected');
                }
            });

            submitRatingBtn.disabled = false;
        });
    });
}

submitRatingBtn?.addEventListener('click', async () => {
    if (selectedRating === 0) return;

    submitRatingBtn.disabled = true;
    submitRatingBtn.textContent = 'Submitting...';

    try {
        await axios.post(`${BASE_URL}/api/users/rate`, {
            targetUserId: targetUserId,
            rating: selectedRating
        }, {
            headers: { Authorization: token }
        });

        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = 'Rating submitted! Redirecting...';
            toast.style.display = 'block';
        }

    } catch (err) {
        console.error('Failed to submit rating:', err);
    }

    setTimeout(() => {
        window.location.href = './dashboard.html';
    }, 1000);
});

skipRatingBtn?.addEventListener('click', () => {
    window.location.href = './dashboard.html';
});

// ── Timer Helper ──
function startTimer() {
    timerInterval = setInterval(() => {
        seconds++;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        callTimer.textContent = `${m}:${s}`;
    }, 1000);
}
