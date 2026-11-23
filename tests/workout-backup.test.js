import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectWorkoutBackup, isZipFile, workoutTranscriptionPrompt} from '../dist/workout-backup.js';
import {parseWorkoutImport} from '../dist/workout-import.js';

test('the exact TSV header in the AI prompt accepts strength and cardio in the same response', () => {
  const header = workoutTranscriptionPrompt.split('\n').find(line => line.startsWith('日付\t'));
  const strength = ['2026-11-01','ベンチプレス',40,'kg',10,'完了','メイン','なし','','','','','',''];
  const cardio = ['2026-11-01','ランニング','','','','完了','有酸素','',15,2,-0.5,8,140,0];
  const parsed = parseWorkoutImport([header,strength.join('\t'),cardio.join('\t')].join('\n'));
  assert.deepEqual(parsed.ignoredColumns, []);
  assert.equal(parsed.rows[0].set.kg,40);
  assert.equal(parsed.rows[1].type,'cardio');
  assert.equal(parsed.rows[1].set.inclinePct,-0.5);
  assert.equal(parsed.rows[1].set.steps,0);
});

// Stand-in payload stays private even to the detecting code; only central metadata is relevant.
function makeZip(entries, comment = '') {
  const localParts = [], directory = [];
  let start = 0;
  for (const {name, aes = 0, encrypted = false} of entries) {
    const filename = Buffer.from(name);
    const extra = aes ? Buffer.from([0x01,0x99,7,0,2,0,0x41,0x45,aes,8,0]) : Buffer.alloc(0);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(filename.length,26);
    const payload = Buffer.alloc(1024);
    localParts.push(header,filename,payload);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50);
    cd.writeUInt16LE(encrypted || aes ? 1 : 0,8);
    cd.writeUInt16LE(aes ? 99 : 0,10);
    cd.writeUInt16LE(filename.length,28);
    cd.writeUInt16LE(extra.length,30);
    cd.writeUInt32LE(start,42);
    directory.push(cd,filename,extra);
    start += header.length + filename.length + payload.length;
  }
  const index = Buffer.concat(directory);
  const text = Buffer.from(comment), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length,8);
  end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(index.length,12);
  end.writeUInt32LE(start,16);
  end.writeUInt16LE(text.length,20);
  return {bytes:Buffer.concat([...localParts,index,end,text]), start};
}

test('encrypted Android backup is identified from the index, without reading any record or cache payload', async () => {
  const {bytes,start} = makeZip([
    {name:'databases/KintoreDB',aes:3},{name:'databases/KintoreDB-wal',aes:3},{name:'cache/unrelated'},
  ]);
  const file = new Blob([bytes]);
  const tracked = {size:file.size, slice(begin,end) {
    const from = begin < 0 ? file.size+begin : begin;
    assert.ok(from >= start,'must not open any archive member');
    return file.slice(begin,end);
  }};
  assert.deepEqual(await inspectWorkoutBackup(tracked),{kind:'kintore', encrypted:true, aesBits:256, hasWal:true});
  assert.equal(await isZipFile(file),true);
});

test('only the matching database and its journal affect encryption status', async () => {
  const check = entries => inspectWorkoutBackup(new Blob([makeZip(entries, 'archive comment').bytes]));
  assert.deepEqual(await check([{name:'databases/KintoreDB'},{name:'cache/KintoreDB-wal',aes:1}]),
    {kind:'kintore',encrypted:false,aesBits:null,hasWal:false});
  assert.deepEqual(await check([{name:'KintoreDB'},{name:'KintoreDB-wal',encrypted:true}]),
    {kind:'kintore',encrypted:true,aesBits:null,hasWal:true});
  assert.deepEqual(await check([{name:'other/KintoreDB.txt'},{name:'KintoreDB-wal',aes:2}]),
    {kind:'other',encrypted:false,aesBits:null,hasWal:false});
});

test('plain CSV, malformed ZIP, and truncated directory are handled distinctly', async () => {
  const file = new Blob(['日付,種目,重量,回数']);
  assert.equal(await isZipFile(file),false);
  await assert.rejects(inspectWorkoutBackup(file),/ZIP/);
  const {bytes,start} = makeZip([{name:'KintoreDB'}]);
  bytes.writeUInt16LE(0xffff,start+28);
  await assert.rejects(inspectWorkoutBackup(new Blob([bytes])),/目次/);
});
