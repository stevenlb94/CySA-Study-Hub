"use strict";

        let questions = [];
        let acronyms = [];
        
        let examQuestions = [];
        let currentQuestionIndex = 0;
        let selectedAnswer = null;
        let selectedLetters = new Set();
        let domainStats = {};
        const DOMAIN_NAMES = {1:"Security Operations",2:"Vulnerability Management",3:"Incident Response and Management",4:"Reporting and Communication"};
        const DOMAIN_WEIGHT = {1:33,2:30,3:20,4:17};
        function esc(s){ return String(s==null?"":s).replace(/[&<>"\u0027]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\u0027":"&#39;"}[c])); }
        function answerLetters(q){ return String(q.answer).split(""); }
        function exhibitHtml(q){
            if (q.exhibit) return `<div class="exhibit"><img src="${q.exhibit}" alt="Question exhibit" loading="lazy"></div>`;
            if (q.exhibitMissing) return `<div class="exhibit-missing">\u26a0 The exhibit for this question is not present in the source material, so this item cannot be answered from the text alone.</div>`;
            return "";
        }
        let answered = false;
        let correctCount = 0;
        let missedQuestions = [];
        let shuffleChoices = true;
        let originalChoiceMapping = {};
        
        let flashcardQuestions = [];
        let currentFlashcardIndex = 0;
        let flashcardCorrectCount = 0;
        let flashcardFlipped = false;
        let flashcardResults = [];
        
        let acronymCards = [];
        let currentAcronymIndex = 0;
        let acronymCorrectCount = 0;
        let acronymFlipped = false;
        let reverseAcronyms = false;
        let acronymResultsList = [];
        
        let modalAction = null;

        function showScreen(screenId) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(screenId).classList.add('active');
        }

        function shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }

        // Modal functions
        function showModal(type) {
            modalAction = type;
            const titles = { exam: 'End exam?', pbq: 'End PBQ exam?', flashcard: 'End session?', acronym: 'End session?' };
            const messages = {
                flashcard: 'Your session will end. Continue?',
                acronym: 'Your session will end. Continue?'
            };
            const confirmBtn = document.getElementById('modal-confirm');
            confirmBtn.textContent = 'End session';

            if (type === 'exam') {
                const n = answeredCount();
                messages.exam = n
                    ? `You'll go straight to your results for the ${n} question${n === 1 ? '' : 's'} you've answered — section breakdown and missed-question review included. The ${examQuestions.length - n} you haven't reached won't count against you.`
                    : "You haven't answered anything yet, so there's nothing to score. Leave the exam?";
                confirmBtn.textContent = n ? 'End & see results' : 'Leave exam';
            }
            if (type === 'pbq') {
                const n = pbqGraded.filter(Boolean).length;
                messages.pbq = n
                    ? `You'll go straight to your results for the ${n} PBQ${n === 1 ? '' : 's'} you've submitted. The ${pbqQuiz.length - n} you haven't reached won't count against you.`
                    : "You haven't submitted any PBQs yet, so there's nothing to score. Leave the exam?";
                confirmBtn.textContent = n ? 'End & see results' : 'Leave exam';
            }

            document.getElementById('modal-title').textContent = titles[type];
            document.getElementById('modal-message').textContent = messages[type];
            document.getElementById('modal-overlay').classList.add('show');
        }

        function hideModal() {
            document.getElementById('modal-overlay').classList.remove('show');
            modalAction = null;
        }

        function closeModal(event) {
            if (event.target === document.getElementById('modal-overlay')) {
                hideModal();
            }
        }

        function navHighlight(label) {
            document.querySelectorAll('.ez-nav-btn').forEach(function (b) {
                b.classList.toggle('is-active', b.textContent.trim() === label);
            });
        }

        function confirmModal() {
            // Read the action BEFORE hideModal(), which clears modalAction.
            const action = modalAction;
            hideModal();
            // Ending an exam early should still show what you earned, not bin it.
            if (action === 'exam' && answeredCount() > 0) {
                showExamResults(true);
                return;
            }
            if (action === 'pbq' && pbqGraded.filter(Boolean).length > 0) {
                showPbqResults(true);
                return;
            }
            showScreen('home-screen');
            navHighlight('Hub menu');
        }

        // EXAM FUNCTIONS
        function startExam() {
            const count = Math.min(parseInt(document.getElementById('exam-question-count').value) || 75, questions.length);
            shuffleChoices = document.getElementById('shuffle-choices').checked;
            examQuestions = shuffleArray(questions).slice(0, count);
            currentQuestionIndex = 0;
            correctCount = 0;
            missedQuestions = [];
            domainStats = {1:{c:0,t:0},2:{c:0,t:0},3:{c:0,t:0},4:{c:0,t:0}};
            showScreen('exam-screen');
            displayQuestion();
        }

        function displayQuestion() {
            const question = examQuestions[currentQuestionIndex];
            const total = examQuestions.length;
            
            document.getElementById('current-question-num').textContent = `Question ${currentQuestionIndex + 1} of ${total}`;
            document.getElementById('exam-progress').style.width = `${((currentQuestionIndex) / total) * 100}%`;
            const badge = document.getElementById('question-domain');
            badge.className = 'domain-badge d' + (question.domain || 1);
            badge.textContent = (question.domain || 1) + '.0 ' + (question.domainName || '');

            const qt = document.getElementById('question-text');
            const needed = answerLetters(question).length;
            const hasEx = !!(question.exhibit || question.exhibitMissing);
            let html = '';
            if (hasEx && question.stemPost) {
                html += `<div class="stem-part">${esc(question.stemPre)}</div>`;
                html += exhibitHtml(question);
                html += `<div class="stem-part">${esc(question.stemPost)}</div>`;
            } else {
                html += `<div class="stem-part">${esc(question.question)}</div>`;
                html += exhibitHtml(question);
            }
            if (needed > 1) html += `<div class="select-hint">Select ${needed} answers.</div>`;
            qt.innerHTML = html;
            
            const choicesContainer = document.getElementById('choices-container');
            choicesContainer.innerHTML = '';
            
            let choiceEntries = Object.entries(question.choices);
            originalChoiceMapping = {};
            
            if (shuffleChoices) {
                const shuffledEntries = shuffleArray(choiceEntries);
                shuffledEntries.forEach((entry, idx) => {
                    const newLetter = String.fromCharCode(65 + idx);
                    originalChoiceMapping[newLetter] = entry[0];
                });
                choiceEntries = shuffledEntries.map((entry, idx) => [String.fromCharCode(65 + idx), entry[1]]);
            } else {
                choiceEntries.forEach(entry => {
                    originalChoiceMapping[entry[0]] = entry[0];
                });
            }
            
            choiceEntries.forEach(([letter, text]) => {
                const div = document.createElement('div');
                div.className = 'choice';
                div.dataset.letter = letter;
                div.innerHTML = `<div class="choice-letter">${letter}</div><div class="choice-text">${text}</div>`;
                div.onclick = () => selectChoice(letter);
                choicesContainer.appendChild(div);
            });
            
            selectedAnswer = null;
            selectedLetters = new Set();
            answered = false;
            document.getElementById('feedback').classList.remove('show', 'correct', 'incorrect');
            document.getElementById('feedback-text').innerHTML = '';
            const sb = document.getElementById('submit-btn');
            sb.classList.remove('hidden');
            sb.disabled = true;
            document.getElementById('next-btn').classList.add('hidden');
        }

        function selectChoice(letter) {
            if (answered) return;
            const needed = answerLetters(examQuestions[currentQuestionIndex]).length;
            if (needed === 1) {
                selectedLetters = new Set([letter]);
            } else if (selectedLetters.has(letter)) {
                selectedLetters.delete(letter);
            } else if (selectedLetters.size < needed) {
                selectedLetters.add(letter);
            }
            document.querySelectorAll('.choice').forEach(c =>
                c.classList.toggle('selected', selectedLetters.has(c.dataset.letter)));
            selectedAnswer = selectedLetters.size ? [...selectedLetters][0] : null;
            document.getElementById('submit-btn').disabled = selectedLetters.size !== needed;
        }

        function submitAnswer() {
            const question = examQuestions[currentQuestionIndex];
            const correctOrig = answerLetters(question);
            if (answered || selectedLetters.size !== correctOrig.length) return;
            answered = true;

            // Map the letters the user clicked back to their original letters.
            const pickedOrig = [...selectedLetters].map(l => originalChoiceMapping[l]).sort();
            const isCorrect = pickedOrig.length === correctOrig.length &&
                              pickedOrig.every((l, i) => l === [...correctOrig].sort()[i]);

            // Which displayed letters hold the correct answers, and their text.
            const displayedCorrect = [];
            for (const [shown, orig] of Object.entries(originalChoiceMapping)) {
                if (correctOrig.includes(orig)) displayedCorrect.push(shown);
            }
            displayedCorrect.sort();
            const correctPairs = displayedCorrect
                .map(shown => `${shown}: ${question.choices[originalChoiceMapping[shown]]}`)
                .join('  •  ');

            document.querySelectorAll('.choice').forEach(c => {
                c.classList.add('disabled');
                const orig = originalChoiceMapping[c.dataset.letter];
                if (correctOrig.includes(orig)) c.classList.add('correct');
                else if (selectedLetters.has(c.dataset.letter)) c.classList.add('incorrect');
            });

            const d = question.domain || 1;
            if (!domainStats[d]) domainStats[d] = {c:0, t:0};
            domainStats[d].t++;
            if (isCorrect) domainStats[d].c++;

            const feedback = document.getElementById('feedback');
            const feedbackTitle = document.getElementById('feedback-title');
            const feedbackText = document.getElementById('feedback-text');

            let html = `<div class="feedback-answer">Correct answer — ${esc(correctPairs)}</div>`;
            html += `<div class="explanation">${esc(question.explanation || '')}</div>`;
            if (shuffleChoices && /\b[A-H][.):,]\s/.test(question.explanation || '')) {
                html += `<div class="shuffle-note">Answer letters quoted in the explanation refer to the original ordering, not the shuffled order above.</div>`;
            }
            if (question.disputed) {
                const votes = Object.entries(question.vote || {})
                    .map(([k, v]) => `${k} ${v}%`).join(', ');
                html += `<div class="dispute-note">\u26a0 The community vote disagrees with the answer key here (${esc(votes)}). Worth double-checking this one.</div>`;
            }
            feedbackText.innerHTML = html;

            if (isCorrect) {
                correctCount++;
                feedback.classList.add('correct');
                feedbackTitle.innerHTML = '\u2713 Correct!';
            } else {
                feedback.classList.add('incorrect');
                feedbackTitle.innerHTML = '\u2717 Incorrect';
                missedQuestions.push({
                    question: question.question,
                    stemPre: question.stemPre,
                    stemPost: question.stemPost,
                    exhibit: question.exhibit,
                    exhibitMissing: question.exhibitMissing,
                    domain: d,
                    domainName: question.domainName,
                    explanation: question.explanation,
                    yourAnswer: [...selectedLetters].sort().join(', '),
                    correctAnswer: displayedCorrect.join(', '),
                    correctText: correctPairs,
                    choices: question.choices
                });
            }

            feedback.classList.add('show');
            document.getElementById('submit-btn').classList.add('hidden');
            document.getElementById('next-btn').classList.remove('hidden');

            if (currentQuestionIndex === examQuestions.length - 1) {
                document.getElementById('next-btn').textContent = 'Finish Exam';
            }
        }

        function nextQuestion() {
            currentQuestionIndex++;
            if (currentQuestionIndex >= examQuestions.length) {
                showExamResults();
            } else {
                document.getElementById('next-btn').textContent = 'Next question';
                displayQuestion();
            }
        }

        // Count of questions actually graded. domainStats is only incremented in
        // submitAnswer, so this is the honest denominator when an exam is ended
        // early — scoring 8 correct out of a planned 75 would read as 11%.
        function answeredCount() {
            return Object.values(domainStats).reduce((a, s) => a + s.t, 0);
        }

        function showExamResults(endedEarly) {
            const total = answeredCount();
            const planned = examQuestions.length;
            const percentage = total ? Math.round((correctCount / total) * 100) : 0;

            document.getElementById('results-heading').textContent =
                endedEarly ? 'Exam Ended Early' : 'Exam Complete';
            const note = document.getElementById('results-note');
            if (endedEarly) {
                note.textContent = `Scored on the ${total} question${total === 1 ? '' : 's'} you answered, out of the ${planned} in this exam.`;
                note.classList.remove('hidden');
            } else {
                note.classList.add('hidden');
            }

            document.getElementById('results-score').textContent = `${percentage}%`;
            document.getElementById('results-correct').textContent = correctCount;
            document.getElementById('results-total').textContent = total;
            document.getElementById('stat-correct').textContent = correctCount;
            document.getElementById('stat-incorrect').textContent = total - correctCount;
            document.getElementById('exam-progress').style.width =
                (endedEarly && planned ? Math.round((total / planned) * 100) : 100) + '%';

            // --- per-domain breakdown ---
            let rows = '';
            let weakest = null;
            for (const d of [1, 2, 3, 4]) {
                const s = domainStats[d] || {c: 0, t: 0};
                if (s.t === 0) {
                    rows += `<div class="section-row"><div class="section-row-top">
                        <span class="section-name">${d}.0 ${DOMAIN_NAMES[d]}</span>
                        <span class="section-empty">no questions drawn</span></div>
                        <div class="section-track"></div></div>`;
                    continue;
                }
                const pct = Math.round((s.c / s.t) * 100);
                if (weakest === null || pct < weakest.pct) weakest = {d, pct, s};
                rows += `<div class="section-row">
                    <div class="section-row-top">
                        <span class="section-name">${d}.0 ${DOMAIN_NAMES[d]}</span>
                        <span class="section-score">${s.c}/${s.t} &nbsp;·&nbsp; <strong>${pct}%</strong></span>
                    </div>
                    <div class="section-track"><div class="section-fill d${d}" style="width:${pct}%"></div></div>
                </div>`;
            }
            let hint = '';
            if (weakest && weakest.pct < 100) {
                hint = `<div class="focus-hint"><strong>Study priority:</strong> ${weakest.d}.0 ${DOMAIN_NAMES[weakest.d]} is your weakest section at ${weakest.pct}% (${weakest.s.c}/${weakest.s.t}). It is ${DOMAIN_WEIGHT[weakest.d]}% of the real exam.</div>`;
            } else if (weakest) {
                hint = `<div class="focus-hint">Clean sweep — every section you were tested on came back 100%.</div>`;
            }
            document.getElementById('section-breakdown').innerHTML =
                `<h3>Performance by exam section</h3>${rows}${hint}`;

            if (missedQuestions.length === 0) {
                document.getElementById('review-missed-btn').classList.add('hidden');
            } else {
                document.getElementById('review-missed-btn').classList.remove('hidden');
                document.getElementById('review-missed-btn').textContent = `Review missed questions (${missedQuestions.length})`;
            }

            document.getElementById('missed-questions-container').classList.add('hidden');
            showScreen('exam-results');
        }

        function showMissedQuestions() {
            const container = document.getElementById('missed-questions-container');
            const list = document.getElementById('missed-questions-list');

            if (container.classList.contains('hidden')) {
                list.innerHTML = missedQuestions.map((q, i) => {
                    const hasEx = !!(q.exhibit || q.exhibitMissing);
                    const body = (hasEx && q.stemPost)
                        ? `<div class="stem-part">${esc(q.stemPre)}</div>${exhibitHtml(q)}<div class="stem-part">${esc(q.stemPost)}</div>`
                        : `<div class="stem-part">${esc(q.question)}</div>${exhibitHtml(q)}`;
                    return `
                    <div class="missed-question-item">
                        <div class="missed-head">
                            <span class="question-number">${i + 1}</span>
                            <span class="domain-badge d${q.domain}">${q.domain}.0 ${esc(q.domainName)}</span>
                        </div>
                        <div class="question-text">${body}</div>
                        <div class="answer-info">
                            <span class="your-answer">Your answer: ${esc(q.yourAnswer)}</span>
                            <span class="correct-answer">Correct: ${esc(q.correctText)}</span>
                        </div>
                        <div class="missed-explanation">${esc(q.explanation || '')}</div>
                    </div>`;
                }).join('');
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        }


        /* ============================ PBQ ============================ */
        let PBQ_POOL = [];
        let pbqQuiz = [], pbqIndex = 0, pbqAnswers = [], pbqGraded = [];

        function pbqNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
        function pbqMatch(expected, val) {
            const v = pbqNorm(val);
            if (v === '') return false;
            const list = Array.isArray(expected) ? expected : [expected];
            return list.some(e => pbqNorm(e) === v);
        }
        function pbqBlank(q) {
            if (q.type === 'grid') return { cells: q.rows.map(() => ({})) };
            if (q.type === 'mcq') return { selected: [] };
            return {};
        }
        function pbqFirst(a) { return Array.isArray(a) ? a[0] : a; }
        function pbqGrade(q, ans) {
            if (q.type === 'grid') {
                let score = 0, max = 0;
                const detail = q.rows.map(() => ({}));
                q.rows.forEach((row, ri) => {
                    const cells = ans.cells[ri] || {};
                    const groups = {};
                    q.columns.forEach(col => {
                        if (col.group) { (groups[col.group] = groups[col.group] || []).push(col); return; }
                        max++;
                        const ok = pbqMatch(row.answer[col.key], cells[col.key]);
                        if (ok) score++;
                        detail[ri][col.key] = { ok, want: pbqFirst(row.answer[col.key]) };
                    });
                    // Grouped columns are interchangeable slots: a value may satisfy any
                    // unclaimed slot, so order does not matter — but duplicates cannot
                    // claim the same slot twice.
                    Object.values(groups).forEach(cols => {
                        const expected = cols.map(c => row.answer[c.key]);
                        const claimed = expected.map(() => false);
                        const hit = cols.map(c => {
                            const v = cells[c.key];
                            for (let j = 0; j < expected.length; j++) {
                                if (!claimed[j] && pbqMatch(expected[j], v)) { claimed[j] = true; return true; }
                            }
                            return false;
                        });
                        const pool = expected.filter((e, j) => !claimed[j]).map(pbqFirst);
                        cols.forEach((c, i) => {
                            max++;
                            if (hit[i]) score++;
                            detail[ri][c.key] = { ok: hit[i], want: hit[i] ? cells[c.key] : (pool.shift() || pbqFirst(row.answer[c.key])) };
                        });
                    });
                });
                return { score, max, correct: score === max, detail };
            }
            if (q.type === 'mcq') {
                const a = ans.selected.slice().sort().join(','), b = q.correct.slice().sort().join(',');
                return { score: a === b ? 1 : 0, max: 1, correct: a === b };
            }
            return { score: 0, max: 1, correct: false };
        }

        function startPbq() {
            const n = Math.min(parseInt(document.getElementById('pbq-question-count').value) || 8, PBQ_POOL.length);
            pbqQuiz = shuffleArray(PBQ_POOL).slice(0, n);
            pbqIndex = 0;
            pbqAnswers = pbqQuiz.map(pbqBlank);
            pbqGraded = pbqQuiz.map(() => null);
            showScreen('pbq-screen');
            displayPbq();
        }

        function pbqExhibitsHtml(q) {
            return (q.exhibits || []).map((src, i) =>
                `<div class="pbq-exhibit"><div class="pbq-exhibit-cap">Exhibit ${i + 1} of ${q.exhibits.length}</div><img src="${src}" alt="PBQ exhibit ${i + 1}" loading="lazy"></div>`
            ).join('');
        }

        function pbqBodyHtml(q, ans, locked) {
            if (q.type === 'mcq') {
                return `<div class="choices">` + Object.entries(q.options).map(([k, t]) => {
                    const chosen = ans.selected.indexOf(k) !== -1;
                    let cls = 'choice';
                    if (chosen) cls += ' selected';
                    if (locked) { cls += ' disabled'; if (q.correct.indexOf(k) !== -1) cls += ' correct'; else if (chosen) cls += ' incorrect'; }
                    return `<div class="${cls}" data-pbq-opt="${esc(k)}"><div class="choice-letter">${esc(k)}</div><div class="choice-text">${esc(t)}</div></div>`;
                }).join('') + `</div>`;
            }
            // grid
            const head = `<th>${esc(q.rowLabel || 'Item')}</th>` + q.columns.map(c => `<th>${esc(c.label)}</th>`).join('');
            const body = q.rows.map((row, ri) => {
                const cells = q.columns.map(col => {
                    const val = (ans.cells[ri] || {})[col.key] || '';
                    if (locked) {
                        const dt = (locked.detail && locked.detail[ri] && locked.detail[ri][col.key]) || null;
                        const ok = dt ? dt.ok : pbqMatch(row.answer[col.key], val);
                        const want = dt ? dt.want : pbqFirst(row.answer[col.key]);
                        return `<td><div class="pbq-cell ${ok ? 'ok' : 'bad'}"><span class="pbq-cell-val">${esc(val || '— blank —')}</span>` +
                               (ok ? '' : `<span class="pbq-cell-want">${esc(want)}</span>`) + `</div></td>`;
                    }
                    if (col.kind === 'text') {
                        return `<td><input type="text" class="pbq-input" data-row="${ri}" data-key="${esc(col.key)}" value="${esc(val)}" placeholder="${esc(col.placeholder || '')}"></td>`;
                    }
                    const opts = `<option value="">-- Select --</option>` +
                        (col.options || []).map(o => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('');
                    return `<td><select class="pbq-select" data-row="${ri}" data-key="${esc(col.key)}">${opts}</select></td>`;
                }).join('');
                return `<tr><td class="pbq-prompt">${esc(row.prompt)}</td>${cells}</tr>`;
            }).join('');
            return `<div class="pbq-grid-wrap"><table class="pbq-grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
        }

        function pbqWire(q, ans) {
            document.querySelectorAll('#pbq-body .pbq-select, #pbq-body .pbq-input').forEach(el => {
                const handler = () => {
                    const ri = +el.dataset.row;
                    ans.cells[ri] = ans.cells[ri] || {};
                    ans.cells[ri][el.dataset.key] = el.value;
                };
                el.addEventListener('change', handler);
                el.addEventListener('input', handler);
            });
            document.querySelectorAll('#pbq-body [data-pbq-opt]').forEach(el => {
                el.addEventListener('click', () => {
                    if (pbqGraded[pbqIndex]) return;
                    const k = el.dataset.pbqOpt;
                    const multi = q.correct.length > 1;
                    if (!multi) ans.selected = [k];
                    else if (ans.selected.indexOf(k) !== -1) ans.selected = ans.selected.filter(x => x !== k);
                    else if (ans.selected.length < q.correct.length) ans.selected.push(k);
                    document.querySelectorAll('#pbq-body [data-pbq-opt]').forEach(o =>
                        o.classList.toggle('selected', ans.selected.indexOf(o.dataset.pbqOpt) !== -1));
                });
            });
        }

        function displayPbq() {
            const q = pbqQuiz[pbqIndex], ans = pbqAnswers[pbqIndex], g = pbqGraded[pbqIndex];
            document.getElementById('pbq-counter').textContent = `PBQ ${pbqIndex + 1} of ${pbqQuiz.length}`;
            document.getElementById('pbq-progress').style.width = `${(pbqIndex / pbqQuiz.length) * 100}%`;
            document.getElementById('pbq-title').textContent = q.title;
            const badge = document.getElementById('pbq-domain');
            badge.className = 'domain-badge d' + q.domain;
            badge.textContent = q.domain + '.0 ' + q.domainName;
            const conf = document.getElementById('pbq-conf');
            conf.className = 'conf-chip ' + q.confidence;
            conf.textContent = q.confidence + ' confidence';
            conf.title = q.confidenceNote || '';
            document.getElementById('pbq-scenario').textContent = q.scenario;
            document.getElementById('pbq-exhibits').innerHTML = pbqExhibitsHtml(q);
            document.getElementById('pbq-body').innerHTML = pbqBodyHtml(q, ans, g);
            if (!g) pbqWire(q, ans);

            const fb = document.getElementById('pbq-feedback');
            fb.classList.remove('show', 'correct', 'incorrect');
            document.getElementById('pbq-submit-btn').classList.toggle('hidden', !!g);
            document.getElementById('pbq-next-btn').classList.toggle('hidden', !g);
            document.getElementById('pbq-next-btn').textContent =
                pbqIndex === pbqQuiz.length - 1 ? 'Finish PBQ Exam' : 'Next PBQ';
        }

        function submitPbq() {
            if (pbqGraded[pbqIndex]) return;
            const q = pbqQuiz[pbqIndex], ans = pbqAnswers[pbqIndex];
            const g = pbqGrade(q, ans);
            pbqGraded[pbqIndex] = g;
            document.getElementById('pbq-body').innerHTML = pbqBodyHtml(q, ans, g);

            const fb = document.getElementById('pbq-feedback');
            fb.classList.add('show', g.correct ? 'correct' : 'incorrect');
            document.getElementById('pbq-feedback-title').innerHTML =
                g.correct ? '\u2713 All sub-answers correct' : `\u25d1 Partial credit — ${g.score} of ${g.max}`;
            let html = `<div class="pbq-score-line">Score: ${g.score} / ${g.max}</div>`;
            html += `<div class="explanation">${esc(q.explanation || '')}</div>`;
            if (q.confidenceNote) html += `<div class="shuffle-note">Answer-key confidence (${esc(q.confidence)}): ${esc(q.confidenceNote)}</div>`;
            document.getElementById('pbq-feedback-text').innerHTML = html;

            document.getElementById('pbq-submit-btn').classList.add('hidden');
            document.getElementById('pbq-next-btn').classList.remove('hidden');
        }

        function nextPbq() {
            pbqIndex++;
            if (pbqIndex >= pbqQuiz.length) showPbqResults();
            else displayPbq();
        }

        function showPbqResults(endedEarly) {
            // Only graded PBQs count toward the denominator, so ending early does
            // not penalise you for the ones you never saw.
            const done = pbqGraded.filter(Boolean).length;
            const score = pbqGraded.reduce((a, g) => a + (g ? g.score : 0), 0);
            const max = pbqGraded.reduce((a, g) => a + (g ? g.max : 0), 0);
            const pct = max ? Math.round((score / max) * 100) : 0;

            document.getElementById('pbq-results-heading').textContent =
                endedEarly ? 'PBQ Exam Ended Early' : 'PBQ Exam Complete';
            const pnote = document.getElementById('pbq-results-note');
            if (endedEarly) {
                pnote.textContent = `Scored on the ${done} PBQ${done === 1 ? '' : 's'} you submitted, out of the ${pbqQuiz.length} in this exam.`;
                pnote.classList.remove('hidden');
            } else {
                pnote.classList.add('hidden');
            }
            document.getElementById('pbq-score').textContent = `${pct}%`;
            document.getElementById('pbq-correct').textContent = score;
            document.getElementById('pbq-total').textContent = max;
            document.getElementById('pbq-stat-full').textContent = pbqGraded.filter(g => g && g.correct).length;
            document.getElementById('pbq-stat-partial').textContent = done - pbqGraded.filter(g => g && g.correct).length;
            document.getElementById('pbq-progress').style.width =
                (endedEarly && pbqQuiz.length ? Math.round((done / pbqQuiz.length) * 100) : 100) + '%';

            document.getElementById('pbq-list').innerHTML = pbqQuiz.map((q, i) => {
                const g = pbqGraded[i];
                const head = `<div><div class="pbq-row-name">${esc(q.title)}</div>
                    <div class="pbq-row-sub">${q.domain}.0 ${esc(q.domainName)} · source question #${q.source}</div></div>`;
                if (!g) {
                    return `<div class="pbq-row">${head}<div class="section-empty">not attempted</div></div>`;
                }
                const p = Math.round((g.score / g.max) * 100);
                return `<div class="pbq-row">${head}
                    <div class="section-score"><strong style="color:${p === 100 ? 'var(--secondary)' : p >= 50 ? 'var(--warning)' : 'var(--danger)'}">${g.score}/${g.max}</strong> · ${p}%</div>
                </div>`;
            }).join('');
            document.getElementById('pbq-review-container').classList.add('hidden');
            showScreen('pbq-results');
        }

        function showPbqReview() {
            const c = document.getElementById('pbq-review-container');
            if (!c.classList.contains('hidden')) { c.classList.add('hidden'); return; }
            document.getElementById('pbq-review-list').innerHTML = pbqQuiz.filter((q, i) => pbqGraded[i]).map((q) => {
                const i = pbqQuiz.indexOf(q);
                const g = pbqGraded[i];
                return `<div class="missed-question-item">
                    <div class="missed-head">
                        <span class="pbq-row-name">${esc(q.title)}</span>
                        <span class="domain-badge d${q.domain}">${q.domain}.0 ${esc(q.domainName)}</span>
                    </div>
                    <div class="pbq-row-sub" style="margin-bottom:0.75rem;">Scored ${g.score} of ${g.max}</div>
                    ${pbqBodyHtml(q, pbqAnswers[i], pbqGraded[i] || true)}
                    <div class="missed-explanation">${esc(q.explanation || '')}</div>
                </div>`;
            }).join('');
            c.classList.remove('hidden');
        }

        function startFlashcards() {
            const count = Math.min(parseInt(document.getElementById('flashcard-count').value) || 30, questions.length);
            flashcardQuestions = shuffleArray(questions).slice(0, count);
            currentFlashcardIndex = 0;
            flashcardCorrectCount = 0;
            flashcardFlipped = false;
            flashcardResults = [];
            showScreen('flashcard-screen');
            displayFlashcard();
        }

        function displayFlashcard() {
            const question = flashcardQuestions[currentFlashcardIndex];

            document.getElementById('flashcard-counter').textContent = `Card ${currentFlashcardIndex + 1} of ${flashcardQuestions.length}`;

            const hasEx = !!(question.exhibit || question.exhibitMissing);
            const body = (hasEx && question.stemPost)
                ? `<div class="stem-part">${esc(question.stemPre)}</div>${exhibitHtml(question)}<div class="stem-part">${esc(question.stemPost)}</div>`
                : `<div class="stem-part">${esc(question.question)}</div>${exhibitHtml(question)}`;
            document.getElementById('flashcard-question').innerHTML =
                `<div class="domain-badge d${question.domain || 1}" style="display:inline-block;margin-bottom:0.75rem;">${question.domain || 1}.0 ${esc(question.domainName || '')}</div>${body}`;

            const correct = answerLetters(question);
            document.getElementById('flashcard-answer').textContent = `Answer: ${correct.join(', ')}`;

            const choicesHtml = Object.entries(question.choices)
                .map(([letter, text]) => {
                    const isCorrect = correct.includes(letter);
                    return `<div class="${isCorrect ? 'correct-choice' : ''}">${esc(letter)}. ${esc(text)}</div>`;
                })
                .join('');
            document.getElementById('flashcard-choices').innerHTML = choicesHtml;

            document.getElementById('flashcard').classList.remove('flipped');
            flashcardFlipped = false;
        }

        function flipCard() {
            document.getElementById('flashcard').classList.toggle('flipped');
            flashcardFlipped = !flashcardFlipped;
        }

        function flashcardResult(knew) {
            if (!flashcardFlipped) {
                flipCard();
                return;
            }
            
            const question = flashcardQuestions[currentFlashcardIndex];
            flashcardResults.push({
                question: question.question,
                answer: question.answer,
                answerText: answerLetters(question).map(l => question.choices[l]).join('  \u2022  '),
                knew: knew
            });
            
            if (knew) flashcardCorrectCount++;
            currentFlashcardIndex++;
            
            if (currentFlashcardIndex >= flashcardQuestions.length) {
                showFlashcardResults();
            } else {
                displayFlashcard();
            }
        }

        function showFlashcardResults() {
            const total = flashcardQuestions.length;
            const percentage = Math.round((flashcardCorrectCount / total) * 100);
            
            document.getElementById('flashcard-score').textContent = `${percentage}%`;
            document.getElementById('flashcard-correct').textContent = flashcardCorrectCount;
            document.getElementById('flashcard-total').textContent = total;
            document.getElementById('flashcard-review-container').classList.add('hidden');
            
            showScreen('flashcard-results');
        }

        function showFlashcardReview() {
            const container = document.getElementById('flashcard-review-container');
            const list = document.getElementById('flashcard-review-list');
            
            if (container.classList.contains('hidden')) {
                list.innerHTML = flashcardResults.map((r, i) => `
                    <div class="missed-question-item">
                        <div class="question-text">${i + 1}. ${r.question}</div>
                        <div class="answer-info">
                            <span class="correct-answer">Answer: ${r.answer} - ${r.answerText}</span>
                            <span style="color: ${r.knew ? 'var(--secondary)' : 'var(--danger)'};">${r.knew ? '✓ Knew it' : '✗ Didn\'t know'}</span>
                        </div>
                    </div>
                `).join('');
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        }

        // ACRONYM FUNCTIONS
        function startAcronyms() {
            const count = Math.min(parseInt(document.getElementById('acronym-card-count').value) || 30, acronyms.length);
            reverseAcronyms = document.getElementById('reverse-acronyms').checked;
            acronymCards = shuffleArray(acronyms).slice(0, count);
            currentAcronymIndex = 0;
            acronymCorrectCount = 0;
            acronymFlipped = false;
            acronymResultsList = [];
            showScreen('acronym-screen');
            displayAcronym();
        }

        function displayAcronym() {
            const acronym = acronymCards[currentAcronymIndex];
            
            document.getElementById('acronym-counter').textContent = `Card ${currentAcronymIndex + 1} of ${acronymCards.length}`;
            
            if (reverseAcronyms) {
                document.getElementById('acronym-front-label').textContent = 'Definition';
                document.getElementById('acronym-front-term').textContent = acronym.meaning;
                document.getElementById('acronym-front-term').style.fontSize = '1.5rem';
                document.getElementById('acronym-back-label').textContent = 'Acronym';
                document.getElementById('acronym-back-meaning').textContent = acronym.acronym;
                document.getElementById('acronym-back-definition').textContent = acronym.definition;
            } else {
                document.getElementById('acronym-front-label').textContent = 'Acronym';
                document.getElementById('acronym-front-term').textContent = acronym.acronym;
                document.getElementById('acronym-front-term').style.fontSize = '3rem';
                document.getElementById('acronym-back-label').textContent = 'Meaning';
                document.getElementById('acronym-back-meaning').textContent = acronym.meaning;
                document.getElementById('acronym-back-definition').textContent = acronym.definition;
            }
            
            document.getElementById('acronym-card').classList.remove('flipped');
            acronymFlipped = false;
        }

        function flipAcronymCard() {
            document.getElementById('acronym-card').classList.toggle('flipped');
            acronymFlipped = !acronymFlipped;
        }

        function acronymResult(knew) {
            if (!acronymFlipped) {
                flipAcronymCard();
                return;
            }
            
            const acronym = acronymCards[currentAcronymIndex];
            acronymResultsList.push({
                acronym: acronym.acronym,
                meaning: acronym.meaning,
                definition: acronym.definition,
                knew: knew
            });
            
            if (knew) acronymCorrectCount++;
            currentAcronymIndex++;
            
            if (currentAcronymIndex >= acronymCards.length) {
                showAcronymResults();
            } else {
                displayAcronym();
            }
        }

        function showAcronymResults() {
            const total = acronymCards.length;
            const percentage = Math.round((acronymCorrectCount / total) * 100);
            
            document.getElementById('acronym-score').textContent = `${percentage}%`;
            document.getElementById('acronym-correct').textContent = acronymCorrectCount;
            document.getElementById('acronym-total').textContent = total;
            document.getElementById('acronym-review-container').classList.add('hidden');
            
            showScreen('acronym-results');
        }

        function showAcronymReview() {
            const container = document.getElementById('acronym-review-container');
            const list = document.getElementById('acronym-review-list');
            
            if (container.classList.contains('hidden')) {
                list.innerHTML = acronymResultsList.map((r, i) => `
                    <div class="missed-question-item">
                        <div class="question-text" style="font-size: 1.25rem; color: var(--primary-light);">${r.acronym}</div>
                        <div style="margin-bottom: 0.5rem;"><strong>${r.meaning}</strong></div>
                        <div style="color: var(--text-secondary); margin-bottom: 0.5rem;">${r.definition}</div>
                        <div style="color: ${r.knew ? 'var(--secondary)' : 'var(--danger)'};">${r.knew ? '✓ Knew it' : '✗ Didn\'t know'}</div>
                    </div>
                `).join('');
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            const activeScreen = document.querySelector('.screen.active').id;
            
            if (e.code === 'Space') {
                e.preventDefault();
                if (activeScreen === 'flashcard-screen') flipCard();
                else if (activeScreen === 'acronym-screen') flipAcronymCard();
            }
            
            if (activeScreen === 'exam-screen' && !answered) {
                const keyMap = { 'KeyA': 'A', 'KeyB': 'B', 'KeyC': 'C', 'KeyD': 'D', 'KeyE': 'E', 'KeyF': 'F' };
                if (keyMap[e.code]) {
                    const choice = document.querySelector(`.choice[data-letter="${keyMap[e.code]}"]`);
                    if (choice) selectChoice(keyMap[e.code]);
                }
            }
            
            if (e.code === 'Enter') {
                if (activeScreen === 'exam-screen') {
                    if (!answered && selectedAnswer) submitAnswer();
                    else if (answered) nextQuestion();
                }
            }
            
            if (e.code === 'Escape') {
                hideModal();
            }
        });

        /* ======================== data loading ========================
           Mirrors the security-plus / az-900 hubs: the bank is fetched from
           data/ at startup rather than inlined, and exhibits are ordinary
           image files under exhibits/ so they load lazily and cache.
           Note this needs to be served over http:// — opening index.html
           straight off the filesystem will fail on fetch(), same as the
           other two hubs. Use run.py / Start-Study-Hub.bat.              */
        async function getJSON(path) {
            const res = await fetch(path, { cache: 'no-store' });
            if (!res.ok) throw new Error(path + ' -> HTTP ' + res.status);
            return res.json();
        }

        function setModesEnabled(on) {
            document.querySelectorAll('#home-screen .mode-card').forEach(function (c) {
                c.style.pointerEvents = on ? '' : 'none';
                c.style.opacity = on ? '' : '0.45';
            });
        }

        async function loadData() {
            const loading = document.getElementById('loading-status');
            const loaded = document.getElementById('loaded-status');
            loading.classList.remove('hidden');
            loaded.classList.add('hidden');
            setModesEnabled(false);
            try {
                const [q, a, p] = await Promise.all([
                    getJSON('data/questions.json'),
                    getJSON('data/acronyms.json'),
                    getJSON('data/pbq.json'),
                ]);
                questions = q; acronyms = a; PBQ_POOL = p;

                document.getElementById('question-count').textContent = questions.length;
                document.getElementById('acronym-count').textContent = acronyms.length;
                document.getElementById('pbq-count').textContent = PBQ_POOL.length;
                document.getElementById('exam-question-count').max = questions.length;
                document.getElementById('pbq-question-count').max = PBQ_POOL.length;
                document.getElementById('pbq-question-count').value = PBQ_POOL.length;
                const fc = document.getElementById('flashcard-count');
                if (fc) fc.max = questions.length;

                loading.classList.add('hidden');
                loaded.classList.remove('hidden');
                setModesEnabled(true);
            } catch (err) {
                console.error(err);
                loading.innerHTML =
                    '<span style="color: var(--danger);">Could not load the question bank (' +
                    String(err.message || err) +
                    '). This hub must be served over http:// — run Start-Study-Hub.bat rather than opening the file directly.</span>';
            }
        }

        document.addEventListener('DOMContentLoaded', loadData);
