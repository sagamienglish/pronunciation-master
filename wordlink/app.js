import {words, sample, scoreWord} from './vocabulary.js';
import {SIZE, TURN_MS, winningPath} from './game.js?v=2';

const $ = id => document.getElementById(id);
const teamLabel = {blue:'Player Blue', orange:'Player Orange'};
const marks = {blue:'●', orange:'◆'};
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const Context = window.AudioContext || window.webkitAudioContext;
const wave = $('wave').getContext('2d');
const width = $('wave').width, height = $('wave').height;
let tiles, owners, buttons, selection, path;
let phase = 'ready', turn = 0, firstTeam = 'blue', matchStart = 0, clock, attempt, mic, matchVersion = 0;

function placeWords(keepWords = false) {
  if (!keepWords) {
    const next = sample(words.filter(word => word.en.length <= 16 && word.en === word.say), SIZE * SIZE);
    if (tiles && next.every((word, index) => word.id === tiles[index].id)) next.push(next.shift());
    tiles = next;
  }
  owners = tiles.map(() => '');
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
    label.className = 'word';
    label.lang = 'en';
    label.textContent = tile.en;
    cell.append(owner, label);
    cell.onclick = () => {
      if (!syncClock() || attempt) return;
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
  $('board').closest('.board-area').dataset.winner = path.length ? currentTeam() : '';
  buttons.forEach((button, index) => {
    const owner = owners[index];
    const pathIndex = path.indexOf(index);
    button.dataset.owner = owner;
    button.classList.toggle('path', pathIndex >= 0);
    button.style.setProperty('--path-delay', pathIndex * 80 + 'ms');
    button.setAttribute('aria-pressed', selection === index);
    button.setAttribute('aria-disabled', !live || Boolean(attempt));
    button.firstChild.textContent = marks[owner] || '';
    button.setAttribute('aria-label', tiles[index].en + '、' + (teamLabel[owner] || '空きマス'));
  });
  $('selected-word').textContent = tiles[selection]?.en ?? '—';
  $('meaning').textContent = tiles[selection]?.ja ?? '好きなマスを選ぼう';
  $('action').textContent = phase === 'starting' ? 'マイクを準備中…' : phase === 'ready' ? '対戦スタート' : phase === 'done' ? '同じ盤面で再戦' : attempt ? '発話を受付中…' : $('demo').checked ? '100点を試す' : 'もう一度発音する';
  $('action').disabled = phase === 'starting' || (live && (selection === null || Boolean(attempt)));
  $('action').classList.toggle('secondary', phase === 'done');
  $('action').classList.toggle('primary', phase !== 'done');
  $('new-board').hidden = phase !== 'done';
  $('demo').disabled = live || phase === 'starting';
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
  if (!Recognition || !Context || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('音声認識に対応していません。「マイクなしで試す」で遊べます。');
  }
  const ctx = new Context();
  let stream;
  try {
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true},video:false});
    if (version !== matchVersion) throw new Error();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return {ctx, stream, analyser};
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
  const current = attempt;
  if (!current) return;
  attempt = null;
  clearTimeout(current.timeout);
  cancelAnimationFrame(current.frame);
  if (current.rec) {
    current.rec.onresult = current.rec.onerror = current.rec.onend = null;
    try { current.rec.abort(); } catch {}
  }
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
  if (phase === 'starting' || phase === 'playing') return;
  const version = ++matchVersion;
  const rematch = phase === 'done';
  const nextStarter = rematch ? opposingTeam(firstTeam) : 'blue';
  showTime(TURN_MS);
  phase = 'starting';
  render();
  try {
    if (!$('demo').checked) mic = await openMic(version);
  } catch (error) {
    if (version !== matchVersion) return;
    phase = rematch ? 'done' : 'ready';
    $('feedback').textContent = error.name === 'NotAllowedError'
      ? 'マイクを許可してください。「マイクなしで試す」でも遊べます。'
      : error.message || 'マイクに接続できませんでした。';
    render();
    return;
  }
  firstTeam = nextStarter;
  turn = 0;
  placeWords(rematch && !differentBoard);
  showTime(TURN_MS);
  phase = 'playing';
  matchStart = performance.now();
  $('feedback').textContent = teamLabel[firstTeam] + 'から。マスを押して発音してください。';
  render();
  clock = setInterval(syncClock, 80);
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
  $('feedback').textContent = ($('demo').checked ? 'デモ採点' : '認識 ' + transcript) + ' · ' + score + '点';
  if (score === 100) {
    owners[current.index] = current.team;
    path = winningPath(owners, current.team);
    if (path.length) {
      finish(current.team);
      return;
    }
  }
  render();
}

function speakSelected() {
  if (!syncClock() || selection === null || attempt) return;
  const current = {index:selection, team:currentTeam()};
  attempt = current;
  render();
  $('feedback').textContent = '「' + tiles[current.index].en + '」';
  if ($('demo').checked) {
    $('wave-state').textContent = 'マイクなし · デモ採点';
    current.timeout = setTimeout(() => complete(current, tiles[current.index].say), 280);
    return;
  }
  const data = new Float32Array(mic.analyser.fftSize);
  const updateWave = () => {
    if (attempt !== current) return;
    mic.analyser.getFloatTimeDomainData(data);
    drawWave(data);
    current.frame = requestAnimationFrame(updateWave);
  };
  try {
    const rec = current.rec = new Recognition();
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    rec.onresult = event => complete(current, event.results[0][0].transcript);
    rec.onerror = event => complete(current, '', event.error === 'not-allowed'
      ? 'ブラウザの音声認識を許可してください。' : '音声を認識できませんでした。もう一度お試しください。');
    rec.onend = () => complete(current, '', '聞き取れませんでした。もう一度お試しください。');
    rec.start();
    $('wave-state').textContent = '発話を受付中';
    current.timeout = setTimeout(() => complete(current, '', '聞き取れませんでした。もう一度お試しください。'), 10000);
    updateWave();
  } catch {
    complete(current, '', '音声認識を始められませんでした。もう一度お試しください。');
  }
}

function finish(winner) {
  phase = 'done';
  clearInterval(clock);
  cancelAttempt();
  closeMic();
  render();
  $('result').style.setProperty('--winner', 'var(--' + winner + ')');
  $('result-title').textContent = teamLabel[winner] + 'の勝ち！';
  $('result-text').textContent = 'Player Blue ' + count('blue') + 'マス ／ Player Orange ' + count('orange') + 'マス';
  $('feedback').textContent = $('result-title').textContent;
  $('confetti').replaceChildren(...Array.from({length:32}, (_, index) => {
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
$('reset').onclick = () => {
  ++matchVersion;
  clearInterval(clock);
  cancelAttempt();
  closeMic();
  phase = 'ready';
  turn = 0;
  placeWords();
  showTime(TURN_MS);
  $('feedback').textContent = '新しい単語で対戦を始められます。';
  render();
};
function playAgain(differentBoard) {
  $('result').close();
  return start({differentBoard});
}
$('rematch').onclick = () => playAgain(false);
$('rematch-new').onclick = () => playAgain(true);
$('new-board').onclick = () => playAgain(true);
$('help').onclick = () => $('rules').showModal();
window.addEventListener('pagehide', () => {
  if (phase === 'playing') $('reset').click();
});
placeWords();
drawWave();
render();
