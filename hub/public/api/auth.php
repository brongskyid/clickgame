<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

/** GET -> siapa saya. POST {action: register|login|guest|upgrade|logout} */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $u = current_user();
  json_out(['ok' => true, 'user' => $u ? public_user($u) : null]);
}
require_mutation();
$in = json_in();
$action = (string)($in['action'] ?? '');
$ip = client_ip();

function clean_username(string $u): string {
  $u = strtolower(trim($u));
  if (!preg_match('/^[a-z0-9_]{3,20}$/', $u)) fail('Username 3-20 huruf kecil, angka, atau _');
  return $u;
}
function clean_name(string $n): string {
  $n = trim(preg_replace('/\s+/', ' ', $n));
  $n = mb_substr($n, 0, 14);
  if ($n === '') fail('Nama tidak boleh kosong');
  return $n;
}
function clean_password(string $p): string {
  if (strlen($p) < 6 || strlen($p) > 200) fail('Password minimal 6 karakter');
  return $p;
}

switch ($action) {
  case 'register': {
    rate_limit("register:$ip", 10, 3600);
    $username = clean_username((string)($in['username'] ?? ''));
    $password = clean_password((string)($in['password'] ?? ''));
    $name = clean_name((string)($in['name'] ?? $username));
    $pdo = db();
    $st = $pdo->prepare('SELECT 1 FROM users WHERE username=?'); $st->execute([$username]);
    if ($st->fetch()) fail('Username sudah dipakai', 409);
    $now = time();
    $pdo->prepare('INSERT INTO users(username, pass_hash, display_name, is_guest, created_at, last_seen) VALUES(?,?,?,0,?,?)')
        ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $name, $now, $now]);
    $id = (int)$pdo->lastInsertId();
    set_session($id);
    json_out(['ok' => true, 'user' => ['id' => $id, 'username' => $username, 'name' => $name, 'guest' => false]]);
  }
  case 'login': {
    rate_limit("login:$ip", 20, 600);
    $username = clean_username((string)($in['username'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $st = db()->prepare('SELECT * FROM users WHERE username=? AND is_guest=0'); $st->execute([$username]);
    $u = $st->fetch();
    if (!$u || !password_verify($password, (string)$u['pass_hash'])) fail('Username atau password salah', 401);
    if (password_needs_rehash((string)$u['pass_hash'], PASSWORD_DEFAULT))
      db()->prepare('UPDATE users SET pass_hash=? WHERE id=?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
    set_session((int)$u['id']);
    json_out(['ok' => true, 'user' => public_user(['id' => (int)$u['id'], 'username' => $u['username'], 'display_name' => $u['display_name'], 'is_guest' => 0])]);
  }
  case 'guest': {
    rate_limit("guest:$ip", 10, 3600);
    $name = clean_name((string)($in['name'] ?? 'Tamu'));
    $now = time();
    db()->prepare('INSERT INTO users(username, pass_hash, display_name, is_guest, created_at, last_seen) VALUES(NULL,NULL,?,1,?,?)')
        ->execute([$name, $now, $now]);
    $id = (int)db()->lastInsertId();
    set_session($id);
    json_out(['ok' => true, 'user' => ['id' => $id, 'username' => null, 'name' => $name, 'guest' => true]]);
  }
  case 'upgrade': {  // tamu -> akun penuh, progres ikut
    $u = require_user();
    if (!$u['is_guest']) fail('Akun sudah penuh');
    rate_limit("register:$ip", 10, 3600);
    $username = clean_username((string)($in['username'] ?? ''));
    $password = clean_password((string)($in['password'] ?? ''));
    $st = db()->prepare('SELECT 1 FROM users WHERE username=?'); $st->execute([$username]);
    if ($st->fetch()) fail('Username sudah dipakai', 409);
    db()->prepare('UPDATE users SET username=?, pass_hash=?, is_guest=0 WHERE id=?')
        ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $u['id']]);
    json_out(['ok' => true, 'user' => ['id' => $u['id'], 'username' => $username, 'name' => $u['display_name'], 'guest' => false]]);
  }
  case 'rename': {
    $u = require_user();
    $name = clean_name((string)($in['name'] ?? ''));
    db()->prepare('UPDATE users SET display_name=? WHERE id=?')->execute([$name, $u['id']]);
    json_out(['ok' => true, 'user' => ['id' => $u['id'], 'username' => $u['username'], 'name' => $name, 'guest' => $u['is_guest']]]);
  }
  case 'logout': {
    clear_session();
    json_out(['ok' => true]);
  }
  default: fail('Aksi tidak dikenal');
}
