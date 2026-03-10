const BASE_URL = 'https://intersync.onrender.com';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// ── Auth Check ──
if (!token) {
    window.location.href = '../index.html';
}

// ── Fetch fresh user data from DB to keep localStorage in sync ──
(async () => {
    try {
        const res = await axios.get(`${BASE_URL}/api/users/profile`, {
            headers: { Authorization: token }
        });
        const freshUser = res.data;
        // Update localStorage with latest DB values
        user.resumeAnalysisCount = freshUser.resumeAnalysisCount || 0;
        user.isPremium = freshUser.isPremium;
        localStorage.setItem('user', JSON.stringify(user));
        updateResumeLimitUI();
    } catch (err) {
        console.error('Failed to sync user profile:', err);
    }
})();

// ── Socket.io Setup for Online Presence & Calling ──
const socket = io(BASE_URL);
let currentCallPeerId = null;
let currentCallerSocketId = null;
let incomingSignalData = null;

socket.on('connect', () => {
    // Register user as online
    socket.emit('register_online', {
        userId: user._id,
        userName: user.name
    });
});

// Update peer status if they come online/offline
socket.on('user_status_change', (data) => {
    if (activePeerMatch && activePeerMatch._id === data.userId) {
        updatePeerStatus(data.status === 'online');
    }
});

socket.on('online_status_result', (data) => {
    if (activePeerMatch && activePeerMatch._id === data.peerId) {
        updatePeerStatus(data.isOnline);
    }
});

// Incoming call
socket.on('incoming_call', (data) => {
    const { callerId, callerName, signalData } = data;

    // Setup modal
    document.getElementById('callerName').textContent = callerName;
    document.getElementById('callerInitial').textContent = callerName.charAt(0).toUpperCase();

    // Store caller details globally for acceptance
    currentCallPeerId = callerId;
    incomingSignalData = signalData;

    // Show modal
    document.getElementById('callModal').classList.add('show');
});

// Call accepted by target
socket.on('call_accepted', (data) => {
    const { receiverId } = data;
    showToast('Call accepted! Connecting...', 'success');

    // Store the receiver ID in localStorage so call.html knows who to connect to
    localStorage.setItem('callTargetId', receiverId);
    localStorage.setItem('isInitiator', 'true');

    setTimeout(() => {
        window.location.href = './call.html';
    }, 1000);
});

// Call rejected
socket.on('call_rejected', (data) => {
    showToast('Call was declined by the peer.', 'error');
    const reqBtn = document.getElementById('requestCallBtn');
    reqBtn.disabled = false;
    reqBtn.innerHTML = '📹 Request Video Call';
});

// Call modal actions
document.getElementById('acceptCallBtn').addEventListener('click', () => {
    document.getElementById('callModal').classList.remove('show');

    // Prepare to answer
    localStorage.setItem('callTargetId', currentCallPeerId);
    localStorage.setItem('isInitiator', 'false');
    if (incomingSignalData) {
        localStorage.setItem('incomingSignal', JSON.stringify(incomingSignalData));
    }

    // Acknowledge logic now happens in call.js to establish WebRTC
    window.location.href = './call.html';
});

document.getElementById('rejectCallBtn').addEventListener('click', () => {
    document.getElementById('callModal').classList.remove('show');
    socket.emit('reject_call', { callerId: currentCallPeerId });
    currentCallPeerId = null;
});


// ── Populate User Info ──
document.getElementById('userName').textContent = user.name || 'User';

if (user.isPremium) {
    document.getElementById('premiumBadge').style.display = 'inline';
    document.getElementById('buyPremiumBtn').style.display = 'none';
    document.getElementById('statStatus').textContent = 'Premium';
    document.getElementById('navQuestionBankBtn').style.display = 'inline-block';
    // Show real leaderboard button, hide the locked teaser
    document.getElementById('viewLeaderboardBtn').style.display = 'inline-flex';
    document.getElementById('lockedLeaderboardBtn').style.display = 'none';
}

document.getElementById('statSkills').textContent = (user.skills || []).length;
document.getElementById('statRating').textContent = user.peerRating || 0;
document.getElementById('statCompanies').textContent = (user.targetCompanies || []).length;

// Show user skills
const mySkillsDiv = document.getElementById('mySkills');
(user.skills || []).forEach(skill => {
    mySkillsDiv.innerHTML += `<span class="skill-tag">${skill}</span>`;
});

// ── Logout ──
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../index.html';
});

// ── Toast Notification ──
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ══════════════════════════════════════════
// PEER MATCHING & REQUEST FLOW
// ══════════════════════════════════════════
const matchSkills = [];
let activePeerMatch = null;

document.getElementById('matchSkillSelect').addEventListener('change', function () {
    const value = this.value;
    if (value && !matchSkills.includes(value)) {
        matchSkills.push(value);
        renderMatchChips();
    }
    this.value = '';
});

function renderMatchChips() {
    const container = document.getElementById('matchSkillChips');
    container.innerHTML = matchSkills.map(s =>
        `<span class="chip">${s} <span class="remove" onclick="removeMatchSkill('${s}')">&times;</span></span>`
    ).join('');
}

function removeMatchSkill(skill) {
    const idx = matchSkills.indexOf(skill);
    if (idx > -1) matchSkills.splice(idx, 1);
    renderMatchChips();
}

document.getElementById('searchPeerBtn').addEventListener('click', async () => {
    const btn = document.getElementById('searchPeerBtn');

    if (matchSkills.length === 0) {
        showToast('Please select at least one skill to match', 'error');
        return;
    }

    btn.innerHTML = '<span class="spinner"></span> Searching...';
    btn.disabled = true;

    try {
        const res = await axios.post(`${BASE_URL}/api/match`, {
            skills: matchSkills,
            targetCompanies: user.targetCompanies || []
        }, {
            headers: { Authorization: token }
        });

        activePeerMatch = res.data.match;
        const matchResult = document.getElementById('matchResult');

        document.getElementById('peerName').textContent = activePeerMatch.name;
        document.getElementById('peerEmail').textContent = `📧 ${activePeerMatch.email}`;
        document.getElementById('peerRating').textContent = activePeerMatch.peerRating || 0;

        const peerSkillsDiv = document.getElementById('peerSkills');
        peerSkillsDiv.innerHTML = (activePeerMatch.skills || []).map(s =>
            `<span class="skill-tag">${s}</span>`
        ).join('');

        matchResult.style.display = 'block';
        showToast('Peer matched successfully!');

        // Start checking online status immediately
        socket.emit('check_online_status', { peerId: activePeerMatch._id });
        updatePeerStatus(false); // Default to offline until Socket replies

    } catch (err) {
        showToast(err.response?.data?.message || 'No matching peer found', 'error');
        document.getElementById('matchResult').style.display = 'none';
        activePeerMatch = null;
    }

    btn.innerHTML = '🔍 Search for Peer';
    btn.disabled = false;
});

function updatePeerStatus(isOnline) {
    const dot = document.getElementById('peerStatusDot');
    const reqBtn = document.getElementById('requestCallBtn');
    const offlineMsg = document.getElementById('offlineMsg');

    if (isOnline) {
        dot.classList.add('online');
        reqBtn.style.display = 'flex';
        offlineMsg.style.display = 'none';
    } else {
        dot.classList.remove('online');
        reqBtn.style.display = 'none';
        offlineMsg.style.display = 'block';
    }
}

// Request Call Button
document.getElementById('requestCallBtn').addEventListener('click', () => {
    if (!activePeerMatch) return;

    // We initiate the call logic directly. In standard WebRTC, we would create an offer.
    // However, to keep it simple, we use the call.js file to handle the actual SimplePeer instance.
    // So we just send a wake-up push notification first. Note: for true signaling completeness, 
    // real signal data passes through call.html. We will just send a basic ping here.

    const btn = document.getElementById('requestCallBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Requesting...';

    // We navigate to call.html immediately and let it generate the offer and send the request_call event.
    // Tell call.html who we want to call and that we are the initiator
    localStorage.setItem('callTargetId', activePeerMatch._id);
    localStorage.setItem('isInitiator', 'true');
    window.location.href = './call.html';
});


// ══════════════════════════════════════════
// GEMINI RESUME ANALYZER
// ══════════════════════════════════════════
const fileUploadArea = document.getElementById('fileUploadArea');
const resumeFileInput = document.getElementById('resumeFile');
const fileNameDisplay = document.getElementById('fileName');

fileUploadArea.addEventListener('click', () => {
    resumeFileInput.click();
});

resumeFileInput.addEventListener('change', () => {
    if (resumeFileInput.files.length > 0) {
        fileNameDisplay.textContent = `📎 ${resumeFileInput.files[0].name}`;
        fileNameDisplay.style.display = 'block';
    }
});

// Update usage text
function updateResumeLimitUI() {
    const limitText = document.getElementById('resumeLimitText');
    if (user.isPremium) {
        limitText.textContent = "Unlimited usage active ✨";
        limitText.style.color = "#00d4aa";
    } else {
        const used = user.resumeAnalysisCount || 0;
        const remaining = Math.max(0, 3 - used);
        limitText.textContent = `Free uses remaining: ${remaining}/3`;

        if (remaining === 0) {
            limitText.style.color = "#ff6b6b";
            document.getElementById('analyzeBtn').disabled = true;
            document.getElementById('analyzeBtn').textContent = '🔒 Upgrade to Analyze';
        }
    }
}
updateResumeLimitUI();

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('analyzeBtn');

    if (!resumeFileInput.files[0]) {
        showToast('Please upload a PDF resume first', 'error');
        return;
    }

    btn.innerHTML = '<span class="spinner"></span> Analyzing with Gemini...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('resume', resumeFileInput.files[0]);

    try {
        const res = await axios.post(`${BASE_URL}/api/analyze-resume`, formData, {
            headers: {
                Authorization: token,
                'Content-Type': 'multipart/form-data'
            }
        });

        const data = res.data;
        const resultDiv = document.getElementById('resumeResult');
        const scoreCircle = document.getElementById('scoreCircle');

        // Score
        let scoreClass = data.score >= 70 ? 'score-high' : data.score >= 40 ? 'score-mid' : 'score-low';
        scoreCircle.className = `score-circle ${scoreClass}`;
        scoreCircle.textContent = data.score;

        document.getElementById('resumeSuggestion').textContent = `"${data.suggestion}"`;

        // Lists
        document.getElementById('aiStrengths').innerHTML = data.strengths.map(i => `<li>${i}</li>`).join('');
        document.getElementById('aiWeaknesses').innerHTML = data.weaknesses.map(i => `<li>${i}</li>`).join('');

        // Keywords
        document.getElementById('aiKeywordsFound').innerHTML = data.foundKeywords.map(k =>
            `<span class="kw-badge kw-found">${k}</span>`
        ).join('');

        document.getElementById('aiKeywordsMissing').innerHTML = data.missingKeywords.map(k =>
            `<span class="kw-badge kw-missing">${k}</span>`
        ).join('');

        resultDiv.style.display = 'block';
        showToast(`AI Analysis Complete! Score: ${data.score}/100`);

        // Update local user state
        if (!user.isPremium) {
            user.resumeAnalysisCount = (user.resumeAnalysisCount || 0) + 1;
            localStorage.setItem('user', JSON.stringify(user));
            updateResumeLimitUI();
        }

    } catch (err) {
        if (err.response?.status === 403) {
            showToast('Free limit reached! Please upgrade to premium.', 'error');
            setTimeout(() => window.location.href = './premium.html', 2000);
        } else {
            showToast(err.response?.data?.message || 'Error analyzing resume', 'error');
        }
    }

    btn.innerHTML = '✨ Analyze with Gemini';
    btn.disabled = false;
});

// ══════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════
const leaderboardModal = document.getElementById('leaderboardModal');

// Locked leaderboard button for free users
document.getElementById('lockedLeaderboardBtn').addEventListener('click', () => {
    showToast('🔒 Leaderboard is a Premium feature. Upgrade to unlock!', 'error');
    setTimeout(() => window.location.href = './premium.html', 1800);
});

document.getElementById('viewLeaderboardBtn').addEventListener('click', async () => {
    leaderboardModal.classList.add('show');
    const list = document.getElementById('leaderboardList');

    try {
        const res = await axios.get(`${BASE_URL}/api/users/leaderboard`, {
            headers: { Authorization: token }
        });

        const users = res.data.leaderboard;
        if (users.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: #888;">No data yet.</div>`;
            return;
        }

        list.innerHTML = users.map((u, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid rgba(108,99,255,0.1); background: ${i === 0 ? 'rgba(255,152,0,0.1)' : 'transparent'}; border-radius: 8px; margin-bottom: 5px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 25px; font-weight: bold; color: ${i === 0 ? '#ff9800' : i === 1 ? '#b0b0cc' : i === 2 ? '#cd7f32' : '#666'};">${i + 1}.</div>
                    <div>
                        <div style="font-weight: 600; font-size: 15px; color: #e0e0e0;">${u.name} ${u.isPremium ? '⭐' : ''}</div>
                        <div style="font-size: 12px; color: #888;">Avg Rating: ${u.peerRating || 0}/5</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: bold; color: #00d4aa;">${u.ratingCount || 0}</div>
                    <div style="font-size: 11px; color: #888;">Interviews</div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        leaderboardModal.classList.remove('show');
        if (err.response?.status === 403) {
            showToast('🔒 Leaderboard is a Premium feature. Upgrade to unlock!', 'error');
            setTimeout(() => window.location.href = './premium.html', 1800);
        } else {
            showToast('Failed to load leaderboard.', 'error');
        }
    }
});

document.getElementById('closeLeaderboardBtn').addEventListener('click', () => {
    leaderboardModal.classList.remove('show');
});
