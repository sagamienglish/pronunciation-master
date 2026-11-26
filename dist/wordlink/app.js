import {LocalSpeechInput} from '../local-speech.js?v=28';
import {sample, scoreWord} from '../vocabulary.js';
import {getLesson} from '../lessons.js?v=20';
import {LESSON_KEY} from '../progress.js?v=20';
import {SIZE, TURN_MS, winningPath} from './game.js?v=2';

const $ = id => document.getElementById(id);
const teamLabel = {blue:'Player Blue', orange:'Player Orange'};
const marks = {blue:'●', orange:'◆'};
const Context = window.AudioContext || window.webkitAudioContext;
const wave = $('wave').getContext('2d');
const width = $('wave').width, height = $('wave').height;
const params = new URLSearchParams(window.location.search);
let savedLesson;
try { savedLesson = window.localStorage.getItem(LESSON_KEY); } catch {}
const lesson = getLesson(params.get('lesson') ?? savedLesson) || getLesson(7);
const words = lesson.words.filter(word => word.say !== 'batter');
const embedded = window.parent !== window && params.has('embedded');
if (embedded) document.body.classList.add('embedded');
let tiles, owners, bestScores, buttons, selection, path;
let phase = 'ready', turn = 0, firstTeam = 'blue', matchStart = 0, clock, attempt, mic, matchVersion = 0;
let countdownClock, scoreClock, scoreReveal;
const recognitionEnvironment = {};
const recognition = new LocalSpeechInput(undefined, ({samples, speechStarted}) => {
  if (!attempt) return;
  $('wave-state').textContent = speechStarted ? '発話を受付中' : '発話を待っています';
  drawWave(samples);
}, recognitionEnvironment);

function placeWords(keepWords = false) {
  if (!keepWords) {
    const next = sample(words, SIZE * SIZE);
    if (tiles && next.every((word, index) => word.id === tiles[index].id)) next.push(next.shift());
    tiles = next;
  }
  owners = tiles.map(() => '');
  bestScores = tiles.map(() => ({}));
  path = [];
  selection = null;
  buttons = tiles.map((tile, index) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'hex';
    const row = Math.floor(index / SIZE);
    cell.style.setProperty('--x', ((index % SIZE + (row % 2) / 2) / 5.5 * 100) + '%');
    cell.style.setProperty('--y', (row * 18.75) + '%');
    const owner = document.createElement('span');
    owner.className = 'owner';
    owner.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = tile.say.length > 15 ? 'word long' : 'word';
    label.lang = 'en';
    label.textContent = tile.say;
    const points = document.createElement('span');
    points.className = 'hex-score';
    points.setAttribute('aria-hidden', 'true');
    points.hidden = true;
    const number = document.createElement('strong');
    const unit = document.createElement('small');
    unit.textContent = '点';
    points.append(number, unit);
    const best = document.createElement('span');
    best.className = 'hex-best';
    best.hidden = true;
    best.setAttribute('aria-hidden','true');
    for (const team of ['blue','orange']) {
      const badge = document.createElement('span');
      badge.dataset.team = team;
      best.append(badge);
    }
    cell.append(owner, label, best, points);
    cell.onclick = () => {
      if (!syncClock() || attempt || scoreReveal) return;
      selection = index;
      speakSelected();
    };
    return cell;
  });
  $('board').replaceChildren(...buttons);
}

function currentTeam() {
  return turn % 2 ? opposingTeam(firstTeam) : firstTeam;
}

function opposingTeam(team) {
  return team === 'blue' ? 'orange' : 'blue';
}

function count(team) {
  return owners.filter(owner => owner === team).length;
}

function render() {
  const live = phase === 'playing';
  const team = currentTeam();
  $('blue-count').textContent = count('blue');
  $('orange-count').textContent = count('orange');
  $('turn').textContent = live || phase === 'done' ? (turn + 1) + ' ターン目' : '20秒交代';
  $('turn-team').textContent = live ? teamLabel[team] + 'の番' : phase === 'done' ? '対戦終了' : '開始前';
  document.querySelector('.team.blue').dataset.active = live && team === 'blue';
  document.querySelector('.team.orange').dataset.active = live && team === 'orange';
  document.documentElement.style.setProperty('--turn-color', 'var(--' + team + ')');
  $('board').closest('.board-area').dataset.winner = path.length ? owners[path[0]] : '';
  buttons.forEach((button, index) => {
    const owner = owners[index];
    const pathIndex = path.indexOf(index);
    button.dataset.owner = owner;
    button.classList.toggle('path', pathIndex >= 0);
    button.style.setProperty('--path-delay', pathIndex * 80 + 'ms');
    button.setAttribute('aria-pressed', selection === index);
    button.setAttribute('aria-disabled', !live || Boolean(attempt || scoreReveal));
    const points = button.lastElementChild;
    const showing = scoreReveal?.index === index;
    points.hidden = !showing;
    if (showing) points.firstElementChild.textContent = scoreReveal.score;
    button.firstChild.textContent = marks[owner] || '';
    const best = points.previousElementSibling;
    const description = [tiles[index].say, teamLabel[owner] || '空きマス'];
    for (const badge of best.children) {
      const team = badge.dataset.team;
      const value = bestScores[index][team];
      badge.hidden = value === undefined;
      if (value !== undefined) {
        badge.textContent = value;
        description.push(teamLabel[team] + 'の最高点 ' + value + '点');
      }
    }
    best.hidden = showing || description.length === 2;
    button.setAttribute('aria-label', description.join('、'));
  });
  $('selected-word').textContent = tiles[selection]?.say ?? '—';
  $('meaning').textContent = tiles[selection]?.ja ?? '好きなマスを選ぼう';
  $('action').textContent = phase === 'starting' ? 'マイクを準備中…' : phase === 'countdown' ? 'まもなく開始…' : phase === 'ready' ? '対戦スタート' : phase === 'done' ? '同じ盤面で再戦' : attempt ? '発話を受付中…' : 'もう一度発音する';
  $('action').disabled = ['starting', 'countdown'].includes(phase) || (live && (selection === null || Boolean(attempt || scoreReveal)));
  $('action').classList.toggle('secondary', phase === 'done');
  $('action').classList.toggle('primary', phase !== 'done');
  $('new-board').hidden = phase !== 'done';
  $('end-match').hidden = !live;
  $('end-match').disabled = Boolean(scoreReveal);
  $('reset').hidden = !live;
}

function drawWave(values) {
  wave.clearRect(0, 0, width, height);
  wave.beginPath();
  wave.strokeStyle = values ? '#d9ed9e' : '#73988b';
  wave.lineWidth = values ? 4 : 2;
  for (let x = 0; x <= width; x += 4) {
    const value = values ? values[Math.min(values.length - 1, Math.floor(x / width * values.length))] : 0;
    const y = height / 2 - Math.max(-1, Math.min(1, 3 * value)) * height * .44;
    if (x === 0) wave.moveTo(x, y);
    else wave.lineTo(x, y);
  }
  wave.stroke();
}

async function openMic(version) {
  if (!Context || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('マイクを利用できません。Safariで開き、マイクの設定を確認してください。');
  }
  const ctx = new Context();
  let stream;
  try {
    const resumed = ctx.resume();
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false});
    } finally {
      await resumed;
    }
    if (version !== matchVersion) throw new Error();
    return {ctx, stream};
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    await ctx.close().catch(() => {});
    throw error;
  }
}

function closeMic() {
  mic?.stream.getTracks().forEach(track => track.stop());
  mic?.ctx.close().catch(() => {});
  mic = null;
}

function cancelAttempt() {
  if (!attempt) return;
  attempt = null;
  recognition.cancel();
  $('wave-state').textContent = 'マイク待機中';
  drawWave();
}

function showTime(ms) {
  const seconds = Math.ceil(Math.max(ms, 0) / 1000);
  const element = $('seconds');
  if (element.firstChild.textContent !== String(seconds)) element.firstChild.textContent = seconds;
  element.classList.toggle('urgent', seconds <= 4);
  $('timer-bar').style.width = (100 * Math.max(ms, 0) / TURN_MS) + '%';
}

function syncClock(now = performance.now()) {
  if (phase !== 'playing') return false;
  const next = Math.floor((now - matchStart) / TURN_MS);
  if (next !== turn) {
    cancelAttempt();
    turn = next;
    selection = null;
    $('feedback').textContent = teamLabel[currentTeam()] + 'に交代。好きなマスを選んでください。';
    render();
  }
  showTime(matchStart + (turn + 1) * TURN_MS - now);
  return true;
}

async function start({differentBoard = false} = {}) {
  if (['starting', 'countdown', 'playing'].includes(phase)) return;
  const version = ++matchVersion;
  const rematch = phase === 'done';
  const nextStarter = rematch ? opposingTeam(firstTeam) : 'blue';
  showTime(TURN_MS);
  phase = 'starting';
  render();
  try {
    mic = await openMic(version);
    if (embedded && typeof window.parent.prepareWordlinkSpeech === 'function') {
      const {model, copySamples} = await window.parent.prepareWordlinkSpeech();
      recognition.model = model;
      recognitionEnvironment.copySamples = copySamples;
    } else {
      await recognition.prepare();
    }
    if (version !== matchVersion) return;
  } catch (error) {
    if (version !== matchVersion) return;
    closeMic();
    phase = rematch ? 'done' : 'ready';
    $('feedback').textContent = error.name === 'NotAllowedError'
      ? 'マイクを許可してください。iPadではSafariの設定も確認してください。'
      : error.message || 'マイクに接続できませんでした。';
    render();
    return;
  }
  firstTeam = nextStarter;
  turn = 0;
  placeWords(rematch && !differentBoard);
  showTime(TURN_MS);
  beginCountdown();
}

function beginCountdown() {
  phase = 'countdown';
  render();
  $('rules').close();
  $('countdown-number').textContent = '3';
  $('countdown-player').textContent = teamLabel[firstTeam] + 'からスタート';
  $('countdown').showModal();
  const endsAt = performance.now() + 3000;
  countdownClock = setInterval(() => {
    const remaining = endsAt - performance.now();
    if (remaining > 0) {
      const digit = String(Math.ceil(remaining / 1000));
      if ($('countdown-number').textContent !== digit) $('countdown-number').textContent = digit;
      return;
    }
    clearInterval(countdownClock);
    $('countdown').close();
    phase = 'playing';
    matchStart = performance.now();
    $('feedback').textContent = teamLabel[firstTeam] + 'から。マスを押して発音してください。';
    render();
    clock = setInterval(syncClock, 80);
  }, 80);
}

function playPerfectChime() {
  const context = mic?.ctx;
  if (context?.state !== 'running') return;
  try {
    const start = context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const time = start + index * .075;
      const end = time + (index === 3 ? .24 : .14);
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.type = 'triangle';
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(.001, time);
      volume.gain.linearRampToValueAtTime(.075, time + .014);
      volume.gain.exponentialRampToValueAtTime(.001, end);
      tone.connect(volume);
      volume.connect(context.destination);
      tone.onended = () => { tone.disconnect(); volume.disconnect(); };
      tone.start(time);
      tone.stop(end);
    });
  } catch {
    // Audio playback is optional for completing a move.
  }
}

function complete(current, transcript, message) {
  if (attempt !== current || !syncClock() || attempt !== current) return;
  cancelAttempt();
  if (message) {
    $('feedback').textContent = message;
    render();
    return;
  }
  const tile = tiles[current.index];
  const score = scoreWord(tile.say, transcript);
  const heard = '認識 ' + transcript;
  const announcement = heard + ' · ' + score + '点';
  $('feedback').textContent = announcement;
  if (score < 100) {
    if (owners[current.index] !== current.team) {
      const best = bestScores[current.index];
      best[current.team] = Math.max(best[current.team] ?? 0, score);
    }
    render();
    return;
  }
  scoreReveal = {index:current.index, score};
  render();
  playPerfectChime();
  const dismiss = () => {
    scoreReveal = null;
    if ($('feedback').textContent === announcement) $('feedback').textContent = heard;
    if (path.length) finish(current.team);
    else render();
  };
  scoreClock = setTimeout(() => {
    owners[current.index] = current.team;
    bestScores[current.index] = {};
    path = winningPath(owners, current.team);
    if (path.length) clearInterval(clock);
    render();
    scoreClock = setTimeout(dismiss, 340);
  }, 600);
}

function speakSelected() {
  if (!syncClock() || selection === null || attempt || scoreReveal) return;
  const current = {index:selection, team:currentTeam()};
  attempt = current;
  render();
  $('feedback').textContent = '「' + tiles[current.index].say + '」';
  $('wave-state').textContent = 'マイク接続中';
  recognition.start({
    capture: mic,
    onTranscript: transcript => complete(current, transcript),
    onError: code => complete(current, '', ({
      'not-allowed':'マイクを許可してください。',
      'audio-capture':'マイクが見つかりません。接続を確認してください。',
      'local-mic-unavailable':'マイクの入力を開始できませんでした。',
      'local-recognition-failed':'音声認識でエラーが起きました。もう一度マスを選んでください。'
    })[code] || '聞き取れませんでした。もう一度お試しください。')
  });
}

function finish(winner) {
  phase = 'done';
  clearInterval(clock);
  cancelAttempt();
  closeMic();
  render();
  $('result').style.setProperty('--winner', winner ? 'var(--' + winner + ')' : 'var(--green)');
  $('result-title').textContent = winner ? teamLabel[winner] + 'の勝ち！' : '引き分け';
  $('result-text').textContent = 'Player Blue ' + count('blue') + 'マス ／ Player Orange ' + count('orange') + 'マス';
  $('feedback').textContent = $('result-title').textContent;
  $('confetti').replaceChildren(...Array.from({length:winner ? 32 : 0}, (_, index) => {
    const piece = document.createElement('i');
    piece.style.setProperty('--left', ((index * 19) % 100) + '%');
    piece.style.setProperty('--delay', (index % 8) * 45 + 'ms');
    piece.style.setProperty('--color', index % 2 ? '#e9b642' : 'var(--' + winner + ')');
    return piece;
  }));
  $('rules').close();
  $('result').showModal();
}

$('action').onclick = () => phase === 'playing' ? speakSelected() : start();
function resetMatch() {
  ++matchVersion;
  clearInterval(clock);
  clearInterval(countdownClock);
  clearTimeout(scoreClock);
  scoreReveal = null;
  $('countdown').close();
  cancelAttempt();
  closeMic();
  phase = 'ready';
  turn = 0;
  placeWords();
  showTime(TURN_MS);
  $('feedback').textContent = '新しい単語で対戦を始められます。';
  render();
}
$('end-match').onclick = () => {
  if (scoreReveal || !syncClock()) return;
  const blue = count('blue'), orange = count('orange');
  finish(blue === orange ? null : blue > orange ? 'blue' : 'orange');
};
$('reset').onclick = resetMatch;
$('cancel-countdown').onclick = resetMatch;
$('countdown').addEventListener('cancel', resetMatch);
function playAgain(differentBoard) {
  $('result').close();
  return start({differentBoard});
}
$('rematch').onclick = () => playAgain(false);
$('rematch-new').onclick = () => playAgain(true);
$('new-board').onclick = () => playAgain(true);
$('help').onclick = () => $('rules').showModal();
function stopActiveMatch() {
  if (['starting', 'countdown', 'playing'].includes(phase)) resetMatch();
}
window.stopWordlinkMatch = stopActiveMatch;
window.addEventListener('pagehide', stopActiveMatch);
placeWords();
drawWave();
render();
