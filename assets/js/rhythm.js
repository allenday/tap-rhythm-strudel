var recordingBPM = false;
var recordingNotes = false;

var bpm = 0;
var interval = 0;
var beatOn = false;
var tick = new Audio('assets/tick.mp3');
var currentBeatStep = 0;
var metronomeStartTime = 0;

var taps = [];
var NOTE_TYPES = [4, 3, 2.5, 2, 1.5, 1, 0.75, 0.5, 0.25, 0.33, 0.66];
var NOTE_NAMES = ["whole", "dottedhalf", "halfneighth", "half", "dottedquarter", "quarter", "dottedeighth", "eighth", "sixteenth", "2etriplet", "2qtriplet"];

var task;
var handleKeydown, handleTouchstart;
var noteText = "sd"; // Default note text for Strudel patterns

document.addEventListener('DOMContentLoaded', function () {
	document.getElementById("bpm").addEventListener('click', bpmButton);
	document.getElementById("notate").addEventListener('click', notesButton);


	// Initialize empty displays
	initializeEmptyDisplays();
});

function updateCurrentPattern() {
	// Update existing pattern with new note text if there's a current pattern
	var strudelTextElement = document.getElementById('strudel-text');
	if (strudelTextElement && taps.length > 0) {
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
	var strudelTextElement = document.getElementById('strudel-text');
	if (strudelTextElement) {
		strudelTextElement.textContent = '[ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ]';
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

	// Calculate the offset - where the first tap landed relative to metronome
	var firstTapMetronomeOffset = 0;
	if (beatOn && metronomeStartTime > 0) {
		var timeFromMetronomeToFirstTap = taps[0] - metronomeStartTime;
		firstTapMetronomeOffset = Math.floor((timeFromMetronomeToFirstTap / interval) * 4);
	}

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
			cell.className = 'step-cell ' + (step === noteText ? 'active' : 'inactive');
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

	var strudelTextElement = document.getElementById('strudel-text');
	if (strudelTextElement) {
		strudelTextElement.textContent = strudelText.trim();
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
		tick.play();

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
		var calculatedStep = Math.floor((timeElapsed / interval) * 4) % 16; // 16th notes, cycling 0-15

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
		}
	}
}


function createRippleFromRhythm(isTooFast) {
	var ripple = document.createElement('div');
	ripple.className = isTooFast ? 'ripple-too-fast' : 'ripple-tap';
	var rhythmElement = document.getElementById('notate');
	var rect = rhythmElement.getBoundingClientRect();
	ripple.style.position = 'fixed';
	ripple.style.left = (rect.left + rect.width/2) + 'px';
	ripple.style.top = (rect.top + rect.height/2) + 'px';
	document.body.appendChild(ripple);
	setTimeout(function(){
		ripple.remove();
	}, 1000);
}

function bpmButton() {
	if (recordingNotes) {
		document.getElementById("bpm").textContent = "Finish notating before resetting BPM.";
	}
	else if (recordingBPM) {
		if (interval > 0) {
			recordingBPM = false;
			window.removeEventListener("keydown", handleKeydown);
			window.removeEventListener("touchstart", handleTouchstart);
			document.getElementById("bpm").innerHTML = "BPM: " + bpm + "<br>Click to record new BPM.";
			toggleBeat();
		}
	}
	else {
		recordingBPM = 1;
		if (beatOn) {toggleBeat();}
		document.getElementById("bpm").textContent = "Tap spacebar to the beat of your music.";
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
					bpm = Math.round(60000/(intervalSum/totalTaps));
					interval = Math.round(60000/bpm);
					document.getElementById("bpm").innerHTML = "BPM: " + bpm + "<br>Click to lock BPM."; // 60000ms in 1 minute
					document.getElementById("notate").innerHTML = "2. Tap rhythm";
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
					bpm = Math.round(60000/(intervalSum/totalTaps));
					interval = Math.round(60000/bpm);
					document.getElementById("bpm").innerHTML = "BPM: " + bpm + "<br>Click to lock BPM."; // 60000ms in 1 minute
					document.getElementById("notate").innerHTML = "2. Tap rhythm";
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
	document.getElementById("notate").innerHTML = "Done! <br>Click to record new rhythm.";
	// Don't call parseTaps() - keep the live positioning
	// parseTaps();
}

function notesButton(e) {
	if (recordingBPM) {
		document.getElementById("notate").innerHTML = "Finish setting BPM first.";
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
			document.getElementById("notate").textContent = "Tap the rhythm you want notated.";

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
						document.getElementById("notate").innerHTML = "Notating for 8 measures...<br>Click to stop early.";
						task = setTimeout(function(){
							stopNotating();
							taps.push(event.timeStamp + interval*32);
						}, interval*32);
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
						document.getElementById("notate").innerHTML = "Notating for 8 measures...<br>Click to stop early.";
						task = setTimeout(function(){
							stopNotating();
							taps.push(event.timeStamp + interval*32);
						}, interval*32);
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
			document.getElementById("notate").textContent = "Please set BPM first.";
			setTimeout(function(){
				document.getElementById("notate").textContent = "2. Tap rhythm";
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
		headerRow.appendChild(th);
	}

	// Create empty 8 measures (128 steps total)
	for (var m = 0; m < 8; m++) {
		var row = document.createElement('tr');
		table.appendChild(row);
		var measureTd = document.createElement('td');
		measureTd.textContent = 'M' + (m + 1);
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
		row.appendChild(measureTd);

		for (var s = 0; s < 16; s++) {
			var step = measures[m][s] || '~';
			var cell = document.createElement('td');
			cell.className = 'step-cell ' + (step === noteText ? 'active' : 'inactive');
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

	var h3 = document.createElement('h3');
	h3.textContent = 'Strudel Pattern:';
	headerDiv.appendChild(h3);

	var noteInput = document.createElement('input');
	noteInput.type = 'text';
	noteInput.id = 'note-text';
	noteInput.value = 'sd';
	noteInput.maxLength = 8;
	noteInput.placeholder = 'sd, hh, oh, etc.';
	noteInput.className = 'note-input';
	headerDiv.appendChild(noteInput);

	var textBox = document.createElement('div');
	textBox.className = 'pattern-box';
	patternDiv.appendChild(textBox);
	var preElement = document.createElement('pre');
	preElement.id = 'strudel-text';
	preElement.textContent = '[ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ] [ ~ ~ ~ ~ ]';
	textBox.appendChild(preElement);

	// Add copy button
	var copyBtn = document.createElement('button');
	copyBtn.className = 'copy-btn';
	copyBtn.textContent = 'Copy Pattern';
	copyBtn.id = 'copy-btn';
	patternDiv.appendChild(copyBtn);
	copyBtn.addEventListener('click', function() {
		var strudelText = document.getElementById('strudel-text').textContent;
		navigator.clipboard.writeText(strudelText).then(function() {
			copyBtn.textContent = "Copied!";
			copyBtn.classList.add("copied");
			setTimeout(function() {
				copyBtn.textContent = "Copy Pattern";
				copyBtn.classList.remove("copied");
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

	// Update the Strudel pattern based on current sequencer state
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

	// Update the Strudel text
	var strudelTextElement = document.getElementById('strudel-text');
	if (strudelTextElement) {
		strudelTextElement.textContent = strudelText.trim();
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

	// Update the existing text element
	var strudelTextElement = document.getElementById('strudel-text');
	if (strudelTextElement) {
		strudelTextElement.textContent = strudelText.trim();
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
	var h3 = document.createElement('h3');
	h3.textContent = 'Strudel Pattern:';
	patternDiv.appendChild(h3);

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

	var textBox = document.createElement('div');
	textBox.className = 'pattern-box';
	patternDiv.appendChild(textBox);
	var preElement = document.createElement('pre');
	preElement.id = 'strudel-text';
	preElement.textContent = strudelText.trim();
	textBox.appendChild(preElement);

	// Add copy button
	var copyBtn = document.createElement('button');
	copyBtn.className = 'copy-btn';
	copyBtn.textContent = 'Copy Pattern';
	copyBtn.id = 'copy-btn';
	patternDiv.appendChild(copyBtn);
	copyBtn.addEventListener('click', function() {
		navigator.clipboard.writeText(strudelText.trim()).then(function() {
			copyBtn.textContent = "Copied!";
			copyBtn.classList.add("copied");
			setTimeout(function() {
				copyBtn.textContent = "Copy Pattern";
				copyBtn.classList.remove("copied");
			}, 2000);
		});
	});
}