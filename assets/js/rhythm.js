var recordingBPM = false;
var recordingNotes = false;

var bpm = 0;
var interval = 0;
var beatOn = false;
var currentBeatStep = 0;
var metronomeStartTime = 0;
var firstTapColumn = 0; // column index (0-15) where first tap should land

var taps = [];
var NOTE_TYPES = [4, 3, 2.5, 2, 1.5, 1, 0.75, 0.5, 0.25, 0.33, 0.66];
var NOTE_NAMES = ["whole", "dottedhalf", "halfneighth", "half", "dottedquarter", "quarter", "dottedeighth", "eighth", "sixteenth", "2etriplet", "2qtriplet"];

var task;
var handleKeydown, handleTouchstart;
var noteText = "sd"; // Default note text for Strudel patterns

// Preview playback state (iframe-based)
var demoPlaying = false;
var mixPlaying = false;
var bpmNeedsLock = false; // true when BPM text was edited and awaits lock

// (metronome and UI code below)

// Playback toggles
function toggleDemoPlayback() { if (demoPlaying) stopIframePlayback('demo'); else startIframePlayback('demo'); }
function toggleMixPlayback() { if (mixPlaying) stopIframePlayback('mix'); else startIframePlayback('mix'); }

function startIframePlayback(kind) {
    var isDemo = kind === 'demo';
    var btnId = isDemo ? 'play-demo-btn' : 'play-mix-btn';
    var playBtn = document.getElementById(btnId);
    var sourceId = isDemo ? 'demo-text' : 'mix-text';
    var txt = (document.getElementById(sourceId) || {}).value || '';
    var dsl = buildStrudelDSLFrom(txt);
    try { console.log('[Strudel][iframe] starting ' + kind + ' with code:\n' + dsl); } catch (e) {}
    try {
        var host = getStrudelHost(kind);
        while (host.firstChild) host.removeChild(host.firstChild);
        var iframe = document.createElement('iframe');
        iframe.id = 'strudel-iframe-' + kind;
        iframe.className = 'strudel-iframe ' + (isDemo ? 'demo' : 'mix');
        iframe.setAttribute('allow', 'autoplay; fullscreen; clipboard-write');
        iframe.src = buildStrudelUrl(dsl);
        host.appendChild(iframe);
        // Add hint + open link
        var hint = document.createElement('div');
        hint.className = 'strudel-hint';
        var a = document.createElement('a');
        a.href = iframe.src;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Open in new tab';
        hint.textContent = 'If audio does not start, click inside the player or ';
        hint.appendChild(a);
        host.appendChild(hint);

        if (isDemo) { demoPlaying = true; } else { mixPlaying = true; }
        if (playBtn) playBtn.textContent = isDemo ? 'Stop Demo' : 'Stop Mix';
    } catch (e) {
        console.error('[Strudel][iframe] failed to start:', e);
    }
}

function stopIframePlayback(kind) {
    var isDemo = kind === 'demo';
    var btnId = isDemo ? 'play-demo-btn' : 'play-mix-btn';
    var playBtn = document.getElementById(btnId);
    try {
        var host = document.getElementById(kind + '-iframe-host');
        if (host) {
            while (host.firstChild) host.removeChild(host.firstChild);
        }
    } catch (e) {}
    if (isDemo) { demoPlaying = false; } else { mixPlaying = false; }
    if (playBtn) playBtn.textContent = isDemo ? 'Play Demo' : 'Play Mix';
}

function getStrudelHost(kind) {
    var hostId = kind + '-iframe-host';
    var host = document.getElementById(hostId);
    if (!host) {
        host = document.createElement('div');
        host.id = hostId;
        host.className = 'iframe-host';
        var anchorId = kind === 'demo' ? 'demo-after' : 'mix-after';
        var anchor = document.getElementById(anchorId);
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(host, anchor.nextSibling);
        } else {
            var staff = document.getElementById('staff');
            staff && staff.appendChild(host);
        }
    }
    return host;
}

function buildStrudelDSLFrom(innerText) {
    var bpmOut = (bpm && !isNaN(bpm)) ? Number(bpm).toFixed(2) : '120.00';
    var inner = (innerText || '').trim();
    return 'setcpm(' + bpmOut + ')\n' + 'sound(`[\n' + inner + '\n]/32`).bank("TR909")';
}

function buildStrudelUrl(code) {
    try {
        var enc = btoa(unescape(encodeURIComponent(code)));
        return 'https://strudel.cc/#' + enc;
    } catch (e) {
        return 'https://strudel.cc/#' + btoa(code);
    }
}

// Test 4/4 removed per UI cleanup

function buildStrudelCodeForCopy() {
    // Build the full Strudel snippet with setcpm and sound wrapper
    var bpmOut = (bpm && !isNaN(bpm)) ? Number(bpm).toFixed(2) : '120.00';
    var inner = ((document.getElementById('demo-text') || {}).value || '').trim();
    // Keep grid with a single wrapper and /32 inside backticks
    var code = 'setcpm(' + bpmOut + ')\n' +
               'sound(`[\n' +
               inner + '\n' +
               ']/32`).bank("TR909")';
    return code;
}

// (no direct Strudel Web API path; preview uses iframe embed only)

document.addEventListener('DOMContentLoaded', function () {
    var bpmBox = document.getElementById("bpm");
    var notateBox = document.getElementById("notate");
    if (bpmBox) bpmBox.addEventListener('click', bpmButton);
    if (notateBox) notateBox.addEventListener('click', notesButton);

    // Initialize empty displays
    initializeEmptyDisplays();

    // Build consolidated transport row for touch-first UX
    buildTransportRow();

    // Optional: autostart metronome at 120 BPM on load
    if (!bpm || isNaN(bpm) || bpm <= 0) {
        bpm = 120.00;
        interval = 60000 / bpm;
        var inp = document.getElementById('bpm-input');
        if (inp) inp.value = bpm.toFixed(2);
    }
    // Start the visual tracker
    if (!beatOn) toggleBeat();
    updateTransportPlayLabel();
});

function updateTransportPlayLabel() {
    // No Play button in simplified UX; keep for compatibility.
}

function buildTransportRow() {
    var section = document.querySelector('section[aria-label="BPM Detection and Rhythm Input"]');
    if (!section) return;
    var existingRow = section.querySelector('.row');
    // Create a dedicated transport row above the legacy boxes
    var transport = document.createElement('div');
    transport.className = 'transport-row';

    // Row 1: Tap/Lock button + BPM text field
    var topControls = document.createElement('div');
    topControls.className = 'transport-top-row';
    var tapBtn = document.createElement('button');
    tapBtn.id = 'tap-bpm-btn';
    tapBtn.className = 'copy-btn';
    tapBtn.textContent = 'Tap BPM';
    tapBtn.addEventListener('click', bpmButton);
    topControls.appendChild(tapBtn);
    var bpmInput = document.createElement('input');
    bpmInput.type = 'number';
    bpmInput.id = 'bpm-input';
    bpmInput.step = '0.01';
    bpmInput.min = '1';
    bpmInput.max = '400';
    bpmInput.value = (bpm && !isNaN(bpm)) ? Number(bpm).toFixed(2) : '120.00';
    bpmInput.className = 'bpm-input';
    bpmInput.addEventListener('input', function(){ onBpmFieldEdited(this.value); });
    bpmInput.addEventListener('change', function(){ onBpmFieldEdited(this.value); });
    topControls.appendChild(bpmInput);
    transport.appendChild(topControls);

    // Row 2: Tap Rhythm button (disabled unless BPM locked)
    var midRow = document.createElement('div');
    midRow.className = 'transport-middle-row';
    var tapRhythm = document.createElement('button');
    tapRhythm.id = 'tap-rhythm-btn';
    tapRhythm.className = 'copy-btn';
    tapRhythm.textContent = 'Tap Rhythm';
    tapRhythm.addEventListener('click', notesButton);
    midRow.appendChild(tapRhythm);
    transport.appendChild(midRow);

    // Row 3: status text
    var status = document.createElement('div');
    status.id = 'transport-status';
    status.className = 'transport-status';
    status.textContent = 'BPM locked at ' + ((bpm && !isNaN(bpm)) ? Number(bpm).toFixed(2) : '120.00');
    transport.appendChild(status);

    if (section && existingRow && existingRow.parentNode) {
        section.insertBefore(transport, existingRow);
    } else {
        section.appendChild(transport);
    }

    // Hide legacy big boxes to reduce confusion
    var legacyBpm = document.getElementById('bpm');
    var legacyNotate = document.getElementById('notate');
    if (legacyBpm) legacyBpm.classList.add('visually-suppressed');
    if (legacyNotate) legacyNotate.classList.add('visually-suppressed');

    // Initial enable/disable: BPM locked -> Tap Rhythm enabled
    setButtonActive('tap-bpm-btn', false);
    var tr = document.getElementById('tap-rhythm-btn');
    if (tr) tr.disabled = false;
}

function applyBpmValue(val){
    var v = parseFloat(val);
    if (!isNaN(v) && v > 0) {
        bpm = Math.round(v * 100) / 100;
        interval = 60000 / bpm;
        var boxEl = document.getElementById('bpm');
        if (boxEl) boxEl.innerHTML = 'BPM: ' + bpm.toFixed(2) + '<br>Click to record new BPM.';
        if (beatOn) { beatOn = false; }
        toggleBeat();
        updateTransportPlayLabel();
        setTransportStatus('BPM locked at ' + bpm.toFixed(2));
        // reset tap-bpm UI and enable tap rhythm
        setButtonActive('tap-bpm-btn', false);
        var tapBtn = document.getElementById('tap-bpm-btn');
        if (tapBtn) { tapBtn.textContent = 'Tap BPM'; tapBtn.classList.remove('warn'); }
        recordingBPM = false;
        var trBtn = document.getElementById('tap-rhythm-btn');
        if (trBtn) trBtn.disabled = false;
        bpmNeedsLock = false;
    }
}

function onBpmFieldEdited(val){
    var v = parseFloat(val);
    if (!isNaN(v) && v > 0) {
        bpmNeedsLock = true;
        bpm = Math.round(v * 100) / 100;
        interval = 60000 / bpm;
        if (beatOn) { beatOn = false; }
        toggleBeat();
        setTransportStatus('BPM ~ ' + bpm.toFixed(2) + ' (Lock BPM to confirm)');
        setButtonActive('tap-bpm-btn', true);
        var tapBtn = document.getElementById('tap-bpm-btn');
        if (tapBtn) { tapBtn.textContent = 'Lock BPM'; tapBtn.classList.add('warn'); }
        var trBtn = document.getElementById('tap-rhythm-btn');
        if (trBtn) trBtn.disabled = true;
        recordingBPM = false; // ensure we are not in tap mode
    }
}

function clearBeatHighlights(){
    try {
        var th = document.querySelector('th.beat-highlight');
        if (th) th.classList.remove('beat-highlight');
        var cells = document.querySelectorAll('td.measure-highlight');
        cells.forEach(function(c){ c.classList.remove('measure-highlight'); });
    } catch (e) {}
}

function setTransportStatus(msg){
    var s = document.getElementById('transport-status');
    if (s) s.textContent = msg;
}

function setButtonActive(btnId, active){
    var el = document.getElementById(btnId);
    if (el) {
        if (active) el.classList.add('active');
        else el.classList.remove('active');
    }
}

function createBpmInputRow() { /* Replaced by buildTransportRow() */ }

function updateCurrentPattern() {
	// Update existing pattern with new note text if there's a current pattern
    var demoEl = document.getElementById('demo-text');
    if (demoEl && taps.length > 0) {
		// Re-generate pattern with current taps and new note text
		if (taps.length >= 2) {
			updatePatternLive();
		}
	}

	// Also update any manually edited sequencer cells with the new note text
	for (var i = 0; i < 128; i++) {
		var cell = document.getElementById('step-' + i);
		if (cell && cell.textContent !== '~' && cell.textContent !== noteText) {
			cell.textContent = noteText;
		}
	}

	// Regenerate the Strudel pattern from current sequencer state
	updateStrudelFromSequencer();
}

function initializeEmptyDisplays() {
    // Create empty step sequencer
    createEmptyStepSequencer();

    // Create empty Strudel pattern box
    createEmptyStrudelPattern();

    // Add manual BPM input row (row 2)
    createBpmInputRow();
}

function resetDisplaysForNewRecording() {
	// Reset step sequencer to empty (128 steps for 8 measures)
	for (var i = 0; i < 128; i++) {
		var cell = document.getElementById('step-' + i);
		if (cell) {
			cell.className = 'step-cell inactive';
			cell.textContent = '~';
		}
	}

	// Reset Strudel pattern to empty
    var demoEl2 = document.getElementById('demo-text');
    if (demoEl2) {
        demoEl2.value = '[ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ]';
    }
}

function updatePatternLive() {
	if (taps.length < 1) return; // Need at least 1 tap

	// Calculate current metronome position in 16th notes since recording started
	var currentTime = performance.now();
	var timeElapsedSinceRecordingStart = currentTime - taps[0];
	var currentMetronomeStep = Math.floor((timeElapsedSinceRecordingStart / interval) * 4);

	// Limit to prevent going beyond reasonable bounds
	var maxStepPosition = Math.min(currentMetronomeStep, 127); // Don't exceed 8 bars

    // Offset so that the first tap lands at the highlighted column within M1
    var firstTapMetronomeOffset = (typeof firstTapColumn === 'number' && firstTapColumn >= 0) ? firstTapColumn : 0;

	// Initialize all steps as rests
	var steps = [];
	for (var i = 0; i <= maxStepPosition + firstTapMetronomeOffset; i++) {
		steps[i] = '~';
	}

	// Place taps at their time-based positions, offset by metronome position
	for (var i = 0; i < taps.length; i++) {
		var tapTime = taps[i] - taps[0]; // Time relative to first tap
		var stepPosition = Math.floor((tapTime / interval) * 4) + firstTapMetronomeOffset; // Add metronome offset

		if (stepPosition <= maxStepPosition + firstTapMetronomeOffset && stepPosition >= 0) {
			if (steps[stepPosition] === '~') {
				steps[stepPosition] = noteText;
			} else {
				// Multiple taps on same step - could add visual indicator here
				// For now, just keep the existing note but could change color
				steps[stepPosition] = noteText; // Could be different symbol/color
			}
		}
	}

	// Pad to minimum display length
	while (steps.length < 16) {
		steps.push('~');
	}

	// Update step sequencer live for all 128 steps
	for (var i = 0; i < 128; i++) {
		var cell = document.getElementById('step-' + i);
		if (cell) {
			var step = steps[i] || '~';
            cell.className = 'step-cell ' + (step !== '~' ? 'active' : 'inactive');
			cell.textContent = step;
		}
	}

	// Update Strudel pattern live - always show full 8 bars
	// Pad to complete 8 measures (128 steps total)
	while (steps.length < 128) {
		steps.push('~');
	}

	// Split into measures and format as Strudel pattern
	var measures = [];
	for (var i = 0; i < steps.length; i += 16) {
		measures.push(steps.slice(i, i + 16));
	}

	var strudelText = "";
	for (var m = 0; m < measures.length; m++) {
		var measure = measures[m];

		// Group into 4-step patterns (quarter notes)
		var quarters = [];
		for (var q = 0; q < 4; q++) {
			var quarter = measure.slice(q * 4, (q + 1) * 4);
			quarters.push("[ " + quarter.join(" ") + " ]");
		}

		strudelText += quarters.join(" ") + "\n";
	}

	var demoEl = document.getElementById('demo-text');
	if (demoEl) {
		demoEl.value = strudelText.trim();
	}
}

function toggleBeat() {
	if (beatOn) {
		beatOn = false;
	}
	else if (!recordingBPM && !recordingNotes && interval > 0) {
		beatOn = true;
		metronomeStartTime = performance.now();
		currentBeatStep = 0;
		flashBeat();
	}
}

function flashBeat() {
    if (beatOn) {
        setTimeout(function() {flashBeat();}, interval/4); // 16th note timing
        // Highlight current step in sequencer (now uses actual time calculation)
        highlightBeatStep();
    }
}


function createRipple() {
	var ripple = document.createElement('div');
	ripple.className = 'ripple';
	document.body.appendChild(ripple);
	setTimeout(function(){
		ripple.remove();
	}, 2000);
}

function highlightBeatStep() {
    // Remove previous beat highlight
    var prevHighlight = document.querySelector('.beat-highlight');
    if (prevHighlight) {
        prevHighlight.classList.remove('beat-highlight');
    }

    // Calculate current step based on actual time elapsed since metronome started
    if (metronomeStartTime > 0) {
        var timeElapsed = performance.now() - metronomeStartTime;
        var totalSixteenths = Math.floor((timeElapsed / interval) * 4); // total 16ths since metronome start
        var calculatedStep = totalSixteenths % 16; // 16th notes, cycling 0-15
        currentBeatStep = calculatedStep;

        // Highlight the column header (th element) for calculated step
        var table = document.querySelector('.sequencer-table');
        if (table) {
            var headerRow = table.querySelector('tr');
            if (headerRow) {
                // calculatedStep is 0-15, but header columns are 1-17 (Step + 1-16)
                var headerCell = headerRow.children[calculatedStep + 1]; // +1 to skip "Step" column
                if (headerCell) {
                    headerCell.classList.add('beat-highlight');
                }
            }

            // Highlight current measure (row label). Prior to first tap in tapping mode, stay on M1.
            // Determine the measure index 0..7
            var measureIndex;
            if (recordingNotes && taps.length === 0) {
                measureIndex = 0; // wait on first measure until first tap happens
            } else {
                measureIndex = Math.floor(totalSixteenths / 16) % 8;
            }
            // Remove previous measure highlight(s)
            var prevMeasures = table.querySelectorAll('td.measure-highlight');
            prevMeasures.forEach(function(el){ el.classList.remove('measure-highlight'); });
            // Rows: 0 header, then M1..M8
            var rows = table.querySelectorAll('tr');
            var row = rows[measureIndex + 1];
            if (row && row.children && row.children[0]) {
                row.children[0].classList.add('measure-highlight');
            }
        }
    }
}


function createRippleFromRhythm(isTooFast) {
    var ripple = document.createElement('div');
    ripple.className = isTooFast ? 'ripple-too-fast' : 'ripple-tap';
    var anchor = document.getElementById('notate');
    if (!anchor || anchor.classList.contains('visually-suppressed')) {
        anchor = document.querySelector('.transport-row') || document.body;
    }
    var rect = anchor.getBoundingClientRect();
    ripple.style.position = 'fixed';
    ripple.style.left = (rect.left + rect.width/2) + 'px';
    ripple.style.top = (rect.top + rect.height/2) + 'px';
    document.body.appendChild(ripple);
    setTimeout(function(){ ripple.remove(); }, 1000);
}

function bpmButton() {
	if (recordingNotes) {
		setTransportStatus("Finish notating before setting BPM.");
		var bpmBox = document.getElementById('bpm');
		if (bpmBox) bpmBox.textContent = "Finish notating before resetting BPM.";
	}
    else if (!recordingBPM && bpmNeedsLock) {
        // Just lock the currently typed BPM value
        var inp = document.getElementById('bpm-input');
        var val = inp ? inp.value : (bpm || 120);
        applyBpmValue(val);
        return;
    }
    else if (recordingBPM) {
        if (interval > 0) {
            recordingBPM = false;
            window.removeEventListener("keydown", handleKeydown);
            window.removeEventListener("touchstart", handleTouchstart);
            var bpmBox2 = document.getElementById('bpm');
            if (bpmBox2) bpmBox2.innerHTML = "BPM: " + (bpm ? bpm.toFixed(2) : '0.00') + "<br>Click to record new BPM.";
            setTransportStatus('BPM locked at ' + (bpm ? bpm.toFixed(2) : '0.00'));
            setButtonActive('tap-bpm-btn', false);
            var tapBtn = document.getElementById('tap-bpm-btn');
            if (tapBtn) { tapBtn.textContent = 'Tap BPM'; tapBtn.classList.remove('warn'); }
            var trBtn = document.getElementById('tap-rhythm-btn');
            if (trBtn) trBtn.disabled = false;
            toggleBeat();
            var tIn3 = document.getElementById('bpm-input');
            if (tIn3 && bpm) tIn3.value = bpm.toFixed(2);
        }
        else {
            setTransportStatus('Tap at least twice to detect BPM');
        }
    }
    else {
        recordingBPM = 1;
        if (beatOn) {toggleBeat();}
        clearBeatHighlights();
        var bpmBox3 = document.getElementById('bpm');
        if (bpmBox3) bpmBox3.textContent = "Tap spacebar to the beat of your music.";
        setTransportStatus('Tap BPM… (press button and tap)');
        setButtonActive('tap-bpm-btn', true);
        var tapBtn2 = document.getElementById('tap-bpm-btn');
        if (tapBtn2) { tapBtn2.textContent = 'Lock BPM'; tapBtn2.classList.add('warn'); }
        var trBtn2 = document.getElementById('tap-rhythm-btn');
        if (trBtn2) trBtn2.disabled = true;
        var lastTap = 0;
        var intervalSum = 0; // intervalSum/totalTaps = averageInterval
        var totalTaps = 0;

        handleKeydown = function(event) {
            if (event.which == 32) { // Spacebar
                event.preventDefault(); // Prevent page scrolling
                if (lastTap > 0) {
                    totalTaps += 1;
                    intervalSum += event.timeStamp - lastTap;
                }
                if (totalTaps > 1) {
                    var bpmCalc = 60000/(intervalSum/totalTaps);
                    bpm = Math.round(bpmCalc * 100) / 100; // two decimals
                    interval = 60000/bpm; // precise ms per beat
                    var bpmBox4 = document.getElementById('bpm');
                    if (bpmBox4) bpmBox4.innerHTML = "BPM: " + bpm.toFixed(2) + "<br>Click to lock BPM.";
                    setTransportStatus('BPM ~ ' + bpm.toFixed(2) + ' (click Tap BPM again to lock)');
                    var tIn = document.getElementById('bpm-input');
                    if (tIn) tIn.value = bpm.toFixed(2);
                }
                lastTap = event.timeStamp;
            }
        };

        handleTouchstart = function(event) {
            if (event.type == "touchstart") {
                if (lastTap > 0) {
                    totalTaps += 1;
                    intervalSum += event.timeStamp - lastTap;
                }
                if (totalTaps > 1) {
                    var bpmCalc = 60000/(intervalSum/totalTaps);
                    bpm = Math.round(bpmCalc * 100) / 100; // two decimals
                    interval = 60000/bpm; // precise ms per beat
                    var bpmBox5 = document.getElementById('bpm');
                    if (bpmBox5) bpmBox5.innerHTML = "BPM: " + bpm.toFixed(2) + "<br>Click to lock BPM.";
                    setTransportStatus('BPM ~ ' + bpm.toFixed(2) + ' (tap again to refine, Tap BPM to lock)');
                    var tIn2 = document.getElementById('bpm-input');
                    if (tIn2) tIn2.value = bpm.toFixed(2);
                }
                lastTap = event.timeStamp;
            }
        };

		window.addEventListener("keydown", handleKeydown);
		window.addEventListener("touchstart", handleTouchstart);
	}
}

function stopNotating() {
    recordingNotes = false;
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("touchstart", handleTouchstart);
    var notateBox = document.getElementById('notate');
    if (notateBox) notateBox.innerHTML = "Done! <br>Click to record new rhythm.";
    setTransportStatus('Stopped tapping rhythm');
    setButtonActive('tap-rhythm-btn', false);
    var trBtnEnd = document.getElementById('tap-rhythm-btn');
    if (trBtnEnd) { trBtnEnd.textContent = 'Tap Rhythm'; trBtnEnd.classList.remove('warn'); }
    // Stop Strudel playback if running
    if (strudelPlaying) {
        stopStrudelPlayback();
    }
    // Don't call parseTaps() - keep the live positioning
    // parseTaps();
}

function notesButton(e) {
    if (recordingBPM) {
        var notateBox2 = document.getElementById('notate');
        if (notateBox2) notateBox2.innerHTML = "Finish setting BPM first.";
        setTransportStatus('Finish setting BPM first');
    }
    else if (recordingNotes) {
        clearTimeout(task);
        taps.push(e.timeStamp);
        stopNotating();
    }
    else {
        if (bpm > 0) {
            recordingNotes = 1;
            taps = [];
            firstTapColumn = 0;
            var notateBox3 = document.getElementById('notate');
            if (notateBox3) notateBox3.textContent = "Tap the rhythm you want notated.";
            setTransportStatus('Tap rhythm with spacebar or finger (mobile).');
            setButtonActive('tap-rhythm-btn', true);
            var trBtnStart = document.getElementById('tap-rhythm-btn');
            if (trBtnStart) { trBtnStart.textContent = 'Done'; trBtnStart.classList.add('warn'); }

			// Reset displays for new recording
			resetDisplaysForNewRecording();

			// Sync metronome timing with new recording
			if (beatOn) {
				metronomeStartTime = performance.now();
			}

			handleKeydown = function(event) {
				if (event.which == 32) { // Spacebar
					event.preventDefault(); // Prevent page scrolling

					// Check if tap is too fast (faster than 16th notes)
					var isTooFast = false;
					if (taps.length > 0) {
						var timeSinceLastTap = event.timeStamp - taps[taps.length - 1];
						var sixteenthNoteInterval = interval / 4; // 16th note duration
						if (timeSinceLastTap < sixteenthNoteInterval * 0.7) { // 70% tolerance
							isTooFast = true;
						}
					}

					createRippleFromRhythm(isTooFast);

                    if (taps.length == 0) {
                        // First tap should land at the currently highlighted column within M1
                        firstTapColumn = currentBeatStep || 0;
                        // Enter continuous notating mode (no auto-stop after 8 measures)
                        var notateBox4 = document.getElementById('notate');
                        if (notateBox4) notateBox4.innerHTML = "Notating...<br>Click to stop.";
                        setTransportStatus('Notating… Click Tap Rhythm to stop');
                    }
					taps.push(event.timeStamp);

					// Live update the pattern
					updatePatternLive();
				}
			};

			handleTouchstart = function(event) {
				if (event.type == "touchstart") {
					// Check if tap is too fast (faster than 16th notes)
					var isTooFast = false;
					if (taps.length > 0) {
						var timeSinceLastTap = event.timeStamp - taps[taps.length - 1];
						var sixteenthNoteInterval = interval / 4; // 16th note duration
						if (timeSinceLastTap < sixteenthNoteInterval * 0.7) { // 70% tolerance
							isTooFast = true;
						}
					}

					createRippleFromRhythm(isTooFast);

                    if (taps.length == 0) {
                        // First tap should land at the currently highlighted column within M1
                        firstTapColumn = currentBeatStep || 0;
                        // Enter continuous notating mode (no auto-stop after 8 measures)
                        var notateBox5 = document.getElementById('notate');
                        if (notateBox5) notateBox5.innerHTML = "Notating...<br>Click to stop.";
                        setTransportStatus('Notating… Click Tap Rhythm to stop');
                    }
					taps.push(event.timeStamp);

					// Live update the pattern
					updatePatternLive();
				}
			};

			window.addEventListener("keydown", handleKeydown);
			window.addEventListener("touchstart", handleTouchstart);
		}
		else {
			var notateBox6 = document.getElementById('notate');
			if (notateBox6) notateBox6.textContent = "Please set BPM first.";
			setTransportStatus('Please set BPM first');
			setTimeout(function(){
				var nb = document.getElementById('notate');
				if (nb) nb.textContent = "2. Tap rhythm";
				setTransportStatus('Ready');
			}, 1000);
		}
	}
}

function parseTaps() {
	//console.log(taps);
	var notes = [];
	var delays = [];
	console.log(taps);
	for (var i = 1; i < taps.length; i++) {
		delays.push(taps[i] - taps[i-1]);
	}
	console.log(delays);
	for (var i = 0; i < delays.length; i++) {
		notes.push(closestNote(delays, i, interval, 10));
	}
	for (var i = 0; i < notes.length; i++) {
		if (notes[i] == 0.33 || notes[i] == 0.66) {
			if (notes[i] != notes[i+1] && notes[i] != notes[i+2]) {
				notes[i] = closestNote(delays, i, interval, 8);
			}
			else {
				notes[i+1] = notes[i];
				notes[i+2] = notes[i];
			}
			i += 2;
		}
	}
	drawNotes(notes);
}

function findMin(array) {
	if (array.length > 0) {
		minIndex = 0;
		minimum = array[0];
		for (var i = 1; i < array.length; i++) {
			if (array[i] < minimum) {
				minIndex = i;
				minimum = array[i];
			}
		}
		return minIndex;
	}
	return [-1, -1];
}

function closestNote(delays, i, interval, endIndex) {
	var time = delays[i];
	var ratio = time/interval;
	var differences = NOTE_TYPES.slice(0, endIndex);
	for (var i = 0; i < differences.length; i++) {
		differences[i] = Math.abs(differences[i] - ratio);
	}
	var minIndex = findMin(differences);
	var minNote = NOTE_TYPES[minIndex];
	return NOTE_TYPES[minIndex];
}

function drawNotes(notes) {
	// Clear and regenerate displays
	var existingSequencer = document.getElementById('step-sequencer');
	var existingPattern = document.getElementById('strudel-pattern');

	if (existingSequencer) existingSequencer.remove();
	if (existingPattern) existingPattern.remove();

	// Add Strudel-style output
	generateStrudelOutput(notes);
}

function generateStrudelOutput(notes) {
	// Convert notes to 16th note grid (4 steps per quarter note)
	var steps = [];
	var currentStep = 0;

	for (var i = 0; i < notes.length; i++) {
		var noteSteps = Math.round(notes[i] * 4); // Convert to 16th note steps

		// Add hit on first step
		steps[currentStep] = noteText;

		// Add rests for remaining steps
		for (var j = 1; j < noteSteps; j++) {
			steps[currentStep + j] = '~';
		}

		currentStep += noteSteps;
	}

	// Pad to complete 8 measures (128 steps total for full 8-bar recording)
	while (steps.length < 128) {
		steps.push('~');
	}

	// Create step sequencer table
	createStepSequencer(steps);

	// Create Strudel pattern text
	createStrudelPattern(steps);
}

function createEmptyStepSequencer() {
	var sequencerDiv = document.createElement('div');
	sequencerDiv.id = 'step-sequencer';
	document.getElementById('staff').appendChild(sequencerDiv);

	var h3 = document.createElement('h3');
	h3.textContent = 'Step Sequencer:';
	sequencerDiv.appendChild(h3);

	var table = document.createElement('table');
	table.className = 'sequencer-table';
	sequencerDiv.appendChild(table);

	// Header row with step numbers
	var headerRow = document.createElement('tr');
	table.appendChild(headerRow);
	var stepHeader = document.createElement('th');
	stepHeader.textContent = 'Step';
	headerRow.appendChild(stepHeader);

	for (var i = 0; i < 16; i++) {
		var th = document.createElement('th');
		th.textContent = i + 1;
		(function(col){ th.addEventListener('click', function(){ toggleColumn(col); }); })(i);
		headerRow.appendChild(th);
	}

	// Create empty 8 measures (128 steps total)
	for (var m = 0; m < 8; m++) {
		var row = document.createElement('tr');
		table.appendChild(row);
		var measureTd = document.createElement('td');
		measureTd.textContent = 'M' + (m + 1);
		(function(measure){ measureTd.addEventListener('click', function(){ toggleMeasureRow(measure); }); })(m);
		row.appendChild(measureTd);

		for (var s = 0; s < 16; s++) {
			var cell = document.createElement('td');
			cell.className = 'step-cell inactive';
			cell.textContent = '~';
			cell.id = 'step-' + (m * 16 + s); // Give each cell an ID for easy updating

			// Add click handler for toggling
			cell.addEventListener('click', function() {
				toggleStepCell(this);
			});

			row.appendChild(cell);
		}
	}

	// Add rotation controls
	var rotateDiv = document.createElement('div');
	rotateDiv.className = 'rotate-controls';
	sequencerDiv.appendChild(rotateDiv);

	var rotateLeftBtn = document.createElement('button');
	rotateLeftBtn.className = 'rotate-btn';
	rotateLeftBtn.innerHTML = '&#9664;';
	rotateLeftBtn.title = 'Rotate left';
	rotateLeftBtn.addEventListener('click', function() {
		rotatePattern(-1);
	});
	rotateDiv.appendChild(rotateLeftBtn);

	var rotateLabel = document.createElement('span');
	rotateLabel.className = 'rotate-label';
	rotateLabel.textContent = 'Rotate Pattern';
	rotateDiv.appendChild(rotateLabel);

	var rotateRightBtn = document.createElement('button');
	rotateRightBtn.className = 'rotate-btn';
	rotateRightBtn.innerHTML = '&#9654;';
	rotateRightBtn.title = 'Rotate right';
	rotateRightBtn.addEventListener('click', function() {
		rotatePattern(1);
	});
	rotateDiv.appendChild(rotateRightBtn);
}

function updateStepSequencer(steps) {
	var existingSequencer = document.getElementById('step-sequencer');
	if (existingSequencer) {
		existingSequencer.remove();
	}
	createStepSequencer(steps);
}

function createStepSequencer(steps) {
	var sequencerDiv = document.createElement('div');
	sequencerDiv.id = 'step-sequencer';
	document.getElementById('staff').appendChild(sequencerDiv);

	var h3 = document.createElement('h3');
	h3.textContent = 'Step Sequencer:';
	sequencerDiv.appendChild(h3);

	var table = document.createElement('table');
	table.className = 'sequencer-table';
	sequencerDiv.appendChild(table);

	// Header row with step numbers
	var headerRow = document.createElement('tr');
	table.appendChild(headerRow);
	var stepHeader = document.createElement('th');
	stepHeader.textContent = 'Step';
	headerRow.appendChild(stepHeader);

	for (var i = 0; i < 16; i++) {
		var th = document.createElement('th');
		th.textContent = i + 1;
		(function(col){ th.addEventListener('click', function(){ toggleColumn(col); }); })(i);
		headerRow.appendChild(th);
	}

	// Split into measures (16 steps each)
	var measures = [];
	for (var i = 0; i < steps.length; i += 16) {
		measures.push(steps.slice(i, i + 16));
	}

	// Create rows for each measure
	for (var m = 0; m < measures.length; m++) {
		var row = document.createElement('tr');
		table.appendChild(row);
		var measureTd = document.createElement('td');
		measureTd.textContent = 'M' + (m + 1);
		(function(measure){ measureTd.addEventListener('click', function(){ toggleMeasureRow(measure); }); })(m);
		row.appendChild(measureTd);

		for (var s = 0; s < 16; s++) {
			var step = measures[m][s] || '~';
			var cell = document.createElement('td');
            cell.className = 'step-cell ' + (step !== '~' ? 'active' : 'inactive');
			cell.textContent = step;
			cell.id = 'step-' + (m * 16 + s); // Give each cell an ID for easy updating

			// Add click handler for toggling
			cell.addEventListener('click', function() {
				toggleStepCell(this);
			});

			row.appendChild(cell);
		}
	}

	// Add rotation controls
	var rotateDiv = document.createElement('div');
	rotateDiv.className = 'rotate-controls';
	sequencerDiv.appendChild(rotateDiv);

	var rotateLeftBtn = document.createElement('button');
	rotateLeftBtn.className = 'rotate-btn';
	rotateLeftBtn.innerHTML = '&#9664;';
	rotateLeftBtn.title = 'Rotate left';
	rotateLeftBtn.addEventListener('click', function() {
		rotatePattern(-1);
	});
	rotateDiv.appendChild(rotateLeftBtn);

	var rotateLabel = document.createElement('span');
	rotateLabel.className = 'rotate-label';
	rotateLabel.textContent = 'Rotate Pattern';
	rotateDiv.appendChild(rotateLabel);

	var rotateRightBtn = document.createElement('button');
	rotateRightBtn.className = 'rotate-btn';
	rotateRightBtn.innerHTML = '&#9654;';
	rotateRightBtn.title = 'Rotate right';
	rotateRightBtn.addEventListener('click', function() {
		rotatePattern(1);
	});
	rotateDiv.appendChild(rotateRightBtn);
}

function createEmptyStrudelPattern() {
    var patternDiv = document.createElement('div');
    patternDiv.id = 'strudel-pattern';
    document.getElementById('staff').appendChild(patternDiv);

    // Create header with title and note text field
    var headerDiv = document.createElement('div');
    headerDiv.className = 'strudel-header';
    patternDiv.appendChild(headerDiv);

    // Left side: Strudel Pattern + note token
    var leftWrap = document.createElement('div');
    leftWrap.className = 'section-inline';
    var h3 = document.createElement('h3');
    h3.textContent = 'Strudel Pattern:';
    leftWrap.appendChild(h3);
    var noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.id = 'note-text';
    noteInput.value = 'sd';
    noteInput.maxLength = 8;
    noteInput.placeholder = 'sd, hh, oh, etc.';
    noteInput.className = 'note-input';
    leftWrap.appendChild(noteInput);
    headerDiv.appendChild(leftWrap);

    // Right side: Demo Pattern label (aligned with textarea)
    var demoLbl = document.createElement('div');
    demoLbl.className = 'section-title';
    demoLbl.textContent = 'Demo Pattern:';
    headerDiv.appendChild(demoLbl);

    // No header playback buttons

    // Demo Pattern (current generated)
    // Demo textarea
    var demoArea = document.createElement('textarea');
    demoArea.id = 'demo-text';
    demoArea.className = 'pattern-text';
    demoArea.value = '[ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ]';
    patternDiv.appendChild(demoArea);
    // Keep grid in sync when user edits demo text
    demoArea.addEventListener('input', onDemoTextEdited);
    demoArea.addEventListener('change', onDemoTextEdited);
    demoArea.addEventListener('blur', onDemoTextEdited);

    // Demo controls (row 1: Play)
    var demoControls1 = document.createElement('div');
    demoControls1.className = 'controls-row';
    patternDiv.appendChild(demoControls1);
    var playDemoBtn = document.createElement('button');
    playDemoBtn.className = 'play-btn';
    playDemoBtn.textContent = 'Play Demo';
    playDemoBtn.id = 'play-demo-btn';
    demoControls1.appendChild(playDemoBtn);
    playDemoBtn.addEventListener('click', toggleDemoPlayback);

    // Demo controls (row 2: Copy + Merge)
    var demoControls2 = document.createElement('div');
    demoControls2.className = 'controls-row';
    patternDiv.appendChild(demoControls2);
    var copyDemo = document.createElement('button');
    copyDemo.className = 'copy-btn';
    copyDemo.textContent = 'Copy Demo Code';
    demoControls2.appendChild(copyDemo);
    copyDemo.addEventListener('click', function() {
        var inner = (document.getElementById('demo-text').value || '').trim();
        var bare = '[\n' + inner + '\n]/32';
        navigator.clipboard.writeText(bare).then(function() {
            copyDemo.textContent = "Copied!";
            copyDemo.classList.add("copied");
            setTimeout(function() {
                copyDemo.textContent = "Copy Demo Code";
                copyDemo.classList.remove("copied");
            }, 2000);
        });
    });

    // Add Demo into Mix button on the same row
    var addDemoBtn = document.createElement('button');
    addDemoBtn.className = 'copy-btn merge-btn';
    addDemoBtn.textContent = 'Add Demo into Mix';
    demoControls2.appendChild(addDemoBtn);
    addDemoBtn.addEventListener('click', mixDemoIntoMix);

    // Anchor where demo iframe will appear
    var demoAfter = document.createElement('div');
    demoAfter.id = 'demo-after';
    patternDiv.appendChild(demoAfter);

    // Mix Pattern (user-editable)
    var mixLabel = document.createElement('div');
    mixLabel.className = 'section-title';
    mixLabel.textContent = 'Mix Pattern:';
    patternDiv.appendChild(mixLabel);
    var mixArea = document.createElement('textarea');
    mixArea.id = 'mix-text';
    mixArea.className = 'pattern-text';
    mixArea.placeholder = 'Paste or build your base mix pattern here...';
    patternDiv.appendChild(mixArea);

    // Mix controls row 1: Play
    var mixControls1 = document.createElement('div');
    mixControls1.className = 'controls-row';
    patternDiv.appendChild(mixControls1);

    var playMixBtn = document.createElement('button');
    playMixBtn.className = 'play-btn';
    playMixBtn.textContent = 'Play Mix';
    playMixBtn.id = 'play-mix-btn';
    mixControls1.appendChild(playMixBtn);
    playMixBtn.addEventListener('click', toggleMixPlayback);

    // Mix controls row 2: Copy
    var mixControls2 = document.createElement('div');
    mixControls2.className = 'controls-row';
    patternDiv.appendChild(mixControls2);

    var copyMix = document.createElement('button');
    copyMix.className = 'copy-btn';
    copyMix.textContent = 'Copy Mix Code';
    mixControls2.appendChild(copyMix);
    copyMix.addEventListener('click', function() {
        var inner = (document.getElementById('mix-text').value || '').trim();
        var bare = '[\n' + inner + '\n]/32';
        navigator.clipboard.writeText(bare).then(function() {
            copyMix.textContent = "Copied!";
            copyMix.classList.add("copied");
            setTimeout(function() {
                copyMix.textContent = "Copy Mix Code";
                copyMix.classList.remove("copied");
            }, 2000);
        });
    });

    // Add event listener for note text input
    noteInput.addEventListener('input', function() {
        noteText = this.value || "sd";
        updateCurrentPattern();
    });
}

function toggleStepCell(cell) {
	// Toggle between active note and rest
	if (cell.textContent === '~') {
		// Make it active
		cell.textContent = noteText;
		cell.className = 'step-cell active';
	} else {
		// Make it rest
		cell.textContent = '~';
		cell.className = 'step-cell inactive';
	}

    // Update the Demo pattern based on current sequencer state
    updateStrudelFromSequencer();
}

function rotatePattern(direction) {
	// Get current pattern from all 128 steps
	var steps = [];
	for (var i = 0; i < 128; i++) {
		var cell = document.getElementById('step-' + i);
		if (cell) {
			steps.push(cell.textContent);
		} else {
			steps.push('~');
		}
	}

	// Rotate by 1 step in the specified direction
	if (direction > 0) {
		// Rotate right: move last element to front
		var lastStep = steps.pop();
		steps.unshift(lastStep);
	} else {
		// Rotate left: move first element to back
		var firstStep = steps.shift();
		steps.push(firstStep);
	}

	// Update all step cells with rotated pattern
	for (var i = 0; i < 128; i++) {
		var cell = document.getElementById('step-' + i);
		if (cell) {
			var step = steps[i] || '~';
			cell.className = 'step-cell ' + (step !== '~' ? 'active' : 'inactive');
			cell.textContent = step;
		}
	}

	// Update Strudel pattern
	updateStrudelFromSequencer();
}

function updateStrudelFromSequencer() {
	// Read the current state of all 128 step cells
	var steps = [];
	for (var i = 0; i < 128; i++) {
		var cell = document.getElementById('step-' + i);
		if (cell) {
			steps.push(cell.textContent);
		} else {
			steps.push('~');
		}
	}

	// Always show full 8 bars (128 steps), don't trim trailing rests
	while (steps.length < 128) {
		steps.push('~');
	}

	// Truncate if somehow longer than 128 steps
	if (steps.length > 128) {
		steps = steps.slice(0, 128);
	}

	// Split into measures and format as Strudel pattern
	var measures = [];
	for (var i = 0; i < steps.length; i += 16) {
		measures.push(steps.slice(i, i + 16));
	}

	var strudelText = "";
	for (var m = 0; m < measures.length; m++) {
		var measure = measures[m];

		// Group into 4-step patterns (quarter notes)
		var quarters = [];
		for (var q = 0; q < 4; q++) {
			var quarter = measure.slice(q * 4, (q + 1) * 4);
			quarters.push("[ " + quarter.join(" ") + " ]");
		}

		strudelText += quarters.join(" ") + "\n";
	}

    // Update the Demo text
    var demoEl = document.getElementById('demo-text');
    if (demoEl) {
        demoEl.value = strudelText.trim();
    }
}

// Toggle helpers for column/row heading clicks
function toggleColumn(colIndex) {
    var anyActive = false;
    for (var m = 0; m < 8; m++) {
        var cell = document.getElementById('step-' + (m * 16 + colIndex));
        if (cell && cell.textContent !== '~') { anyActive = true; break; }
    }
    var makeActive = !anyActive;
    for (var m2 = 0; m2 < 8; m2++) {
        var c = document.getElementById('step-' + (m2 * 16 + colIndex));
        if (!c) continue;
        if (makeActive) {
            c.textContent = noteText;
            c.className = 'step-cell active';
        } else {
            c.textContent = '~';
            c.className = 'step-cell inactive';
        }
    }
    updateStrudelFromSequencer();
}

function toggleMeasureRow(measureIndex) {
    var base = measureIndex * 16;
    var anyActive = false;
    for (var s = 0; s < 16; s++) {
        var cell = document.getElementById('step-' + (base + s));
        if (cell && cell.textContent !== '~') { anyActive = true; break; }
    }
    var makeActive = !anyActive;
    for (var s2 = 0; s2 < 16; s2++) {
        var c = document.getElementById('step-' + (base + s2));
        if (!c) continue;
        if (makeActive) {
            c.textContent = noteText;
            c.className = 'step-cell active';
        } else {
            c.textContent = '~';
            c.className = 'step-cell inactive';
        }
    }
    updateStrudelFromSequencer();
}

// --- Sync demo textarea -> grid ---
var demoTextTimer = null;
function onDemoTextEdited() {
    if (demoTextTimer) clearTimeout(demoTextTimer);
    demoTextTimer = setTimeout(applyDemoTextToSequencer, 250);
}

function applyDemoTextToSequencer() {
    var demo = (document.getElementById('demo-text') || {}).value || '';
    var steps = parsePatternToSteps(demo);
    for (var i = 0; i < 128; i++) {
        var cell = document.getElementById('step-' + i);
        if (!cell) continue;
        var tok = steps[i] || '~';
        cell.textContent = tok;
        cell.className = 'step-cell ' + (tok !== '~' ? 'active' : 'inactive');
    }
}

function updateStrudelPattern(steps) {
	// Split into measures and format as Strudel pattern
	var measures = [];
	for (var i = 0; i < steps.length; i += 16) {
		measures.push(steps.slice(i, i + 16));
	}

	var strudelText = "";
	for (var m = 0; m < measures.length; m++) {
		var measure = measures[m];

		// Group into 4-step patterns (quarter notes)
		var quarters = [];
		for (var q = 0; q < 4; q++) {
			var quarter = measure.slice(q * 4, (q + 1) * 4);
			quarters.push("[ " + quarter.join(" ") + " ]");
		}

		strudelText += quarters.join(" ") + "\n";
	}

    // Update the existing Demo element
    var demoEl2 = document.getElementById('demo-text');
    if (demoEl2) {
        demoEl2.value = strudelText.trim();
    }
}

function createStrudelPattern(steps) {
    var existingPattern = document.getElementById('strudel-pattern');
    if (existingPattern) {
        existingPattern.remove();
    }

    var patternDiv = document.createElement('div');
    patternDiv.id = 'strudel-pattern';
    document.getElementById('staff').appendChild(patternDiv);
    // Create header with title, note text field, and play button
    var headerDiv = document.createElement('div');
    headerDiv.className = 'strudel-header';
    patternDiv.appendChild(headerDiv);

    // Header left: Strudel Pattern + sound token, right: Demo Pattern label
    var leftHeader = document.createElement('div');
    leftHeader.className = 'section-inline';
    var h3 = document.createElement('div');
    h3.textContent = 'Strudel Pattern:';
    h3.className = 'section-title';
    leftHeader.appendChild(h3);
    var noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.id = 'note-text';
    noteInput.value = noteText || 'sd';
    noteInput.maxLength = 8;
    noteInput.placeholder = 'sd, hh, oh, etc.';
    noteInput.className = 'note-input';
    leftHeader.appendChild(noteInput);
    headerDiv.appendChild(leftHeader);

    var demoHdr = document.createElement('div');
    demoHdr.className = 'section-label';
    demoHdr.textContent = 'Demo Pattern:';
    headerDiv.appendChild(demoHdr);

	// Split into measures and format as Strudel pattern
	var measures = [];
	for (var i = 0; i < steps.length; i += 16) {
		measures.push(steps.slice(i, i + 16));
	}

    var strudelText = "";
	for (var m = 0; m < measures.length; m++) {
		var measure = measures[m];

		// Group into 4-step patterns (quarter notes)
		var quarters = [];
		for (var q = 0; q < 4; q++) {
			var quarter = measure.slice(q * 4, (q + 1) * 4);
			quarters.push("[ " + quarter.join(" ") + " ]");
		}

		strudelText += quarters.join(" ") + "\n";
	}

    // Demo Pattern (textarea)
    var demoArea = document.createElement('textarea');
    demoArea.id = 'demo-text';
    demoArea.className = 'pattern-text';
    demoArea.value = strudelText.trim();
    patternDiv.appendChild(demoArea);
    demoArea.addEventListener('input', onDemoTextEdited);
    demoArea.addEventListener('change', onDemoTextEdited);
    demoArea.addEventListener('blur', onDemoTextEdited);

    // Demo controls row
    var demoControls = document.createElement('div');
    demoControls.className = 'controls-row';
    patternDiv.appendChild(demoControls);
    var playDemoBtn = document.createElement('button');
    playDemoBtn.className = 'play-btn';
    playDemoBtn.textContent = 'Play Demo';
    playDemoBtn.id = 'play-demo-btn';
    demoControls.appendChild(playDemoBtn);
    playDemoBtn.addEventListener('click', toggleDemoPlayback);

    var copyDemo = document.createElement('button');
    copyDemo.className = 'copy-btn';
    copyDemo.textContent = 'Copy Demo Code';
    demoControls.appendChild(copyDemo);
    copyDemo.addEventListener('click', function() {
        var inner = (document.getElementById('demo-text').value || '').trim();
        var bare = '[\n' + inner + '\n]/32';
        navigator.clipboard.writeText(bare).then(function() {
            copyDemo.textContent = "Copied!";
            copyDemo.classList.add("copied");
            setTimeout(function() {
                copyDemo.textContent = "Copy Demo Code";
                copyDemo.classList.remove("copied");
            }, 2000);
        });
    });
    var mixIntoBtn = document.createElement('button');
    mixIntoBtn.className = 'copy-btn merge-btn';
    mixIntoBtn.textContent = 'Mix Demo into Mix';
    demoControls.appendChild(mixIntoBtn);
    mixIntoBtn.addEventListener('click', mixDemoIntoMix);

    // Anchor for demo iframe
    var demoAfter = document.createElement('div');
    demoAfter.id = 'demo-after';
    patternDiv.appendChild(demoAfter);

    // Mix Pattern
    var mixLabel = document.createElement('div');
    mixLabel.className = 'section-title';
    mixLabel.textContent = 'Mix Pattern:';
    patternDiv.appendChild(mixLabel);
    var mixArea = document.createElement('textarea');
    mixArea.id = 'mix-text';
    mixArea.placeholder = 'Paste or build your base mix pattern here...';
    patternDiv.appendChild(mixArea);

    var mixControls = document.createElement('div');
    mixControls.className = 'controls-row';
    patternDiv.appendChild(mixControls);
    // (Mix into button moved to demoControls row)

    var playMixBtn = document.createElement('button');
    playMixBtn.className = 'play-btn';
    playMixBtn.textContent = 'Play Mix';
    playMixBtn.id = 'play-mix-btn';
    mixControls.appendChild(playMixBtn);
    playMixBtn.addEventListener('click', toggleMixPlayback);

    var copyMix = document.createElement('button');
    copyMix.className = 'copy-btn';
    copyMix.textContent = 'Copy Mix Code';
    mixControls.appendChild(copyMix);
    copyMix.addEventListener('click', function() {
        var inner = (document.getElementById('mix-text').value || '').trim();
        var bare = '[\n' + inner + '\n]/32';
        navigator.clipboard.writeText(bare).then(function() {
            copyMix.textContent = "Copied!";
            copyMix.classList.add("copied");
            setTimeout(function() {
                copyMix.textContent = "Copy Mix Code";
                copyMix.classList.remove("copied");
            }, 2000);
        });
    });

    // Anchor for mix iframe
    var mixAfter = document.createElement('div');
    mixAfter.id = 'mix-after';
    patternDiv.appendChild(mixAfter);

    // Note input listener
    noteInput.addEventListener('input', function() {
        noteText = this.value || "sd";
        updateCurrentPattern();
    });
}

// --- Mixing utilities ---
function parsePatternToSteps(text) {
    if (!text) return Array(128).fill('~');
    var tokens = text.split(/\s+/).filter(Boolean);
    var steps = [];
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (t === '[' || t === ']') continue; // quarter wrappers
        steps.push(t);
        if (steps.length >= 128) break;
    }
    while (steps.length < 128) steps.push('~');
    return steps.slice(0, 128);
}

function tokenToSet(tok) {
    if (!tok || tok === '~') return new Set();
    if (tok.startsWith('[') && tok.endsWith(']')) {
        var inner = tok.slice(1, -1);
        return new Set(inner.split(',').map(function(s){return s.trim();}).filter(Boolean));
    }
    return new Set([tok.trim()]);
}

function setToToken(set) {
    if (!set || set.size === 0) return '~';
    if (set.size === 1) return Array.from(set)[0];
    // Keep insertion order not guaranteed; sort for stability
    var arr = Array.from(set);
    return '[' + arr.join(',') + ']';
}

function stepsToPatternText(steps) {
    var out = '';
    for (var m = 0; m < 8; m++) {
        var measure = steps.slice(m*16, m*16 + 16);
        var quarters = [];
        for (var q = 0; q < 4; q++) {
            var quarter = measure.slice(q*4, q*4+4);
            quarters.push('[ ' + quarter.join(' ') + ' ]');
        }
        out += quarters.join(' ') + '\n';
    }
    return out.trim();
}

function mixDemoIntoMix() {
    var demo = (document.getElementById('demo-text') || {}).value || '';
    var mix = (document.getElementById('mix-text') || {}).value || '';
    var demoSteps = parsePatternToSteps(demo);
    var mixSteps = parsePatternToSteps(mix);
    var merged = [];
    for (var i = 0; i < 128; i++) {
        var a = mixSteps[i] || '~';
        var b = demoSteps[i] || '~';
        if (a === '~' && b === '~') { merged.push('~'); continue; }
        if (a === '~') { merged.push(b); continue; }
        if (b === '~') { merged.push(a); continue; }
        var set = tokenToSet(a);
        var setB = tokenToSet(b);
        setB.forEach(function(v){ set.add(v); });
        merged.push(setToToken(set));
    }
    var mergedText = stepsToPatternText(merged);
    var mixArea = document.getElementById('mix-text');
    if (mixArea) mixArea.value = mergedText;
}
