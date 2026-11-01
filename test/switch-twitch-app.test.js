import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { SharedStore } from "../shared-service/src/store.js";
import { resetAppAuthorizations } from "../scripts/switch-app-maintenance.js";

function fixture() {
  const key = randomBytes(32);
  const store = new SharedStore(":memory:", {
    encryptionKey: key,
    patternSeed: randomBytes(32),
    catalog: [{ id: "skin", name: "Skin", tier: 1 }],
  });
  store.saveChannel("123", "Streamer", {
    access_token: randomBytes(20).toString("hex"),
  });
  store.saveOverlaySettings("123", {
    preset: "02",
    games: ["Game"],
    events: ["cheer"],
  });
  store.record({
    id: "example-event",
    channel: "123",
    viewer: { id: "456", name: "Viewer" },
    type: "gift",
    gifts: 10,
    tier: "1000",
    at: new Date().toISOString(),
  });
  store.selectPattern("456", "skin");
  store.updateAppearance("456", {
    patternScale: 1.3,
    chestType: "emoji",
    chestValue: "🤖",
  });
  store.createSession("456", "viewer");
  store.createSession("123", "streamer");
  store.saveBot("789", "ExampleBot", {
    access_token: randomBytes(20).toString("hex"),
  });
  return { key, store };
}

test("app migration clears only authorizations and preserves progression, appearance and channel settings", () => {
  const { key, store } = fixture();
  try {
    const before = store.viewer("456"),
      settings = store.overlaySettings("123");
    const ledger = store.db.prepare("SELECT * FROM ledger").all();
    const receipts = store.db.prepare("SELECT * FROM receipts").all();
    assert.deepEqual(resetAppAuthorizations(store.db, key), {
      reconnectChannels: 1,
    });
    assert.deepEqual(store.viewer("456"), before);
    assert.deepEqual(store.overlaySettings("123"), settings);
    assert.deepEqual(store.db.prepare("SELECT * FROM ledger").all(), ledger);
    assert.deepEqual(
      store.db.prepare("SELECT * FROM receipts").all(),
      receipts,
    );
    assert.equal(store.channelExists("123"), true);
    assert.equal(store.hasChannel("123"), false);
    assert.deepEqual(store.channelCredentials("123"), {});
    for (const table of ["sessions", "bot_credentials", "unlock_notices"])
      assert.equal(
        store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,
        0,
      );
    // Rerunning maintenance is safe; reauthorization reuses the existing row.
    resetAppAuthorizations(store.db, key);
    store.saveChannel("123", "Streamer", {});
    assert.equal(store.hasChannel("123"), true);
    assert.deepEqual(store.viewer("456"), before);
    assert.deepEqual(store.overlaySettings("123"), settings);
  } finally {
    store.close();
  }
});

test("maintenance errors roll back auth changes and cannot delete earned data", () => {
  const { key, store } = fixture();
  try {
    store.db.exec(
      "CREATE TRIGGER refuse_session_delete BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT,'example failure'); END",
    );
    assert.throws(() => resetAppAuthorizations(store.db, key));
    assert.equal(store.hasChannel("123"), true);
    assert.equal(store.viewer("456").points, 10);
    assert.equal(store.botStatus().connected, true);
    assert.equal(
      store.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n,
      2,
    );
  } finally {
    store.close();
  }
});

test("private env rewrite preserves other values byte-for-byte and rejects malformed credentials and duplicate entries", () => {
  const result = execFileSync(
    "python3",
    [
      "-c",
      `
import runpy, secrets
from pathlib import Path
m=runpy.run_path('scripts/switch-twitch-app.py',run_name='test_helpers')
a,b,c,d,e,f=[secrets.token_hex(24) for _ in range(6)]
old='# retain comment\\nTWITCH_CLIENT_ID='+a+'\\nTWITCH_CLIENT_SECRET='+b+'\\nTWITCH_WEBHOOK_SECRET='+c+'\\nDATA_ENCRYPTION_KEY='+d+'\\nPATTERN_SEED='+e+'\\nPUBLIC_BASE_URL=https://trizze.tv/robot/api/\\n'
new=m['replacement_env'](old,f,a,b)
assert 'DATA_ENCRYPTION_KEY='+d+'\\n' in new
assert 'PATTERN_SEED='+e+'\\n' in new
assert '# retain comment\\n' in new
assert 'TWITCH_CLIENT_ID='+f+'\\n' in new
assert 'TWITCH_CLIENT_SECRET='+a+'\\n' in new
assert 'TWITCH_WEBHOOK_SECRET='+b+'\\n' in new
for bad in ['oops\\ninjected=true','bad space','short','x'*257]:
 try:m['replacement_env'](old,bad,a,b)
 except ValueError:pass
 else:raise AssertionError('invalid input accepted')
for bad in [old+'TWITCH_CLIENT_ID='+a+'\\n',old.replace('PATTERN_SEED=','OTHER=')]:
 try:m['replacement_env'](bad,f,a,b)
 except ValueError:pass
 else:raise AssertionError('invalid old config accepted')
# Compile exactly the transmitted source; never execute its server entry point.
source=Path('scripts/switch-twitch-app.py').read_text()
remote=source.rsplit("\\nif __name__ == '__main__':",1)[0]+'\\nserver_main('+repr('example maintenance source')+')\\n'
compile(remote,'<remote-helper>','exec')
# Validation rejects redirects and failures without surfacing response payloads.
class Failure:
 def open(self,*a,**k): raise RuntimeError('sensitive response must not be echoed')
original=m['validate_new_app'].__globals__['urllib'].request.build_opener
m['validate_new_app'].__globals__['urllib'].request.build_opener=lambda *a:Failure()
try:
 try:m['validate_new_app'](a,b)
 except ValueError as error: assert str(error)=='Twitch could not validate the new credentials. Nothing changed.'
 else:raise AssertionError('validation failure accepted')
finally:m['validate_new_app'].__globals__['urllib'].request.build_opener=original
print('private helper tests passed')
`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.trim(), "private helper tests passed");
});

test("owner helper recreates only the scoped container and restores the old env on failed health checks", () => {
  const output = execFileSync(
    "python3",
    [
      "-c",
      `
import runpy,secrets,io,types,contextlib,stat
m=runpy.run_path('scripts/switch-twitch-app.py',run_name='private_test')
g=m['server_main'].__globals__
a,b,c,d,e,f=[secrets.token_hex(24) for _ in range(6)]
old='TWITCH_CLIENT_ID='+a+'\\nTWITCH_CLIENT_SECRET='+b+'\\nTWITCH_WEBHOOK_SECRET='+c+'\\nDATA_ENCRYPTION_KEY='+d+'\\nPATTERN_SEED='+e+'\\n'
original_stat,original_open,original_fdopen=g['os'].stat,g['os'].open,g['os'].fdopen
original_uid=g['os'].geteuid
original_stdin=g['sys'].stdin
original_run=g['subprocess'].run
try:
 g['os'].geteuid=lambda:0
 g['os'].stat=lambda path,**kw:types.SimpleNamespace(st_uid=0,st_mode=(stat.S_IFREG|0o600) if path.endswith('.env') else (stat.S_IFDIR|0o755))
 g['os'].open=lambda *a:42
 g['os'].fdopen=lambda *a,**kw:io.StringIO(old)
 g['subprocess'].run=lambda *a,**kw:types.SimpleNamespace(returncode=0)
 g['validate_new_app']=lambda *a:None
 for works in [True,False]:
  calls=[];writes=[]
  def fake_docker(*args,**kw):
   calls.append(args)
   if args[:2]==('inspect','--format'):
    return 'true' if args[2]=='{{.State.Running}}' else 'sha256:'+'a'*64
   return ''
  g['docker']=fake_docker
  g['atomic_env_write']=writes.append
  g['healthy']=lambda:works
  g['sys'].stdin=io.StringIO(g['json'].dumps({'clientId':f,'clientSecret':a}))
  try:
   with contextlib.redirect_stdout(io.StringIO()) as log:m['server_main']('nonsecret maintenance source')
   assert works
   assert 'Service health: OK' in log.getvalue()
  except RuntimeError as error:
   assert not works
   assert 'previous app configuration was restored' in str(error)
  assert 'DATA_ENCRYPTION_KEY='+d+'\\n' in writes[0]
  assert 'PATTERN_SEED='+e+'\\n' in writes[0]
  for args in calls:
   assert not any(a in arg or f in arg for arg in args)
   if args[:2]==('run','-d'):
    assert '127.0.0.1:8100:8080' in args and '--memory=192m' in args and '--cpus=0.5' in args
    assert '--env-file' in args
  assert any(args[:1]==('stop',) and args[1]=='robot-alerts' for args in calls)
  if not works:
   assert writes[-1]==old
   assert ('start','robot-alerts') in calls
finally:
 g['os'].stat,g['os'].open,g['os'].fdopen=original_stat,original_open,original_fdopen
 g['os'].geteuid=original_uid
 g['sys'].stdin=original_stdin
 g['subprocess'].run=original_run
print('scoped migration and recovery passed')
`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(output.trim(), "scoped migration and recovery passed");
});
